/**
 * Migra itens existentes para o sistema de listas customizáveis.
 *
 * Uso seguro (somente ambiente administrativo):
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npm run migrate
 *
 * A service role nunca deve ser colocada em VITE_* nem enviada ao navegador.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para executar a migração.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TYPE_LISTS = {
  anime: 'Animes',
  animacao: 'Animações',
  serie: 'Séries'
};

async function findOrCreateList(userId, nome, isSystem = false) {
  const { data: existing, error: findError } = await supabase
    .from('user_lists')
    .select('*')
    .eq('user_id', userId)
    .eq('nome', nome)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data: last, error: orderError } = await supabase
    .from('user_lists')
    .select('ordem')
    .eq('user_id', userId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw orderError;

  const { data: created, error: createError } = await supabase
    .from('user_lists')
    .insert({
      user_id: userId,
      nome,
      is_system: isSystem,
      ordem: (last?.ordem ?? -1) + 1
    })
    .select()
    .single();
  if (createError) throw createError;
  return created;
}

async function addItemToList(itemId, listId) {
  const { error } = await supabase
    .from('item_lists')
    .upsert({ item_id: itemId, list_id: listId }, { onConflict: 'item_id,list_id', ignoreDuplicates: true });
  if (error) throw error;
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 1000) return users;
  }
}

async function migrateData() {
  console.log('Iniciando migração administrativa...');
  const users = await listAllUsers();
  console.log(`Usuários encontrados: ${users.length}`);

  for (const user of users) {
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, tipo, status')
      .eq('user_id', user.id);
    if (itemsError) throw itemsError;
    if (!items?.length) continue;

    const defaultList = await findOrCreateList(user.id, 'Minha Lista');
    const wishlist = await findOrCreateList(user.id, 'Próximos', true);
    const listsByType = new Map();

    for (const item of items) {
      const listName = TYPE_LISTS[item.tipo];
      if (listName && !listsByType.has(listName)) {
        listsByType.set(listName, await findOrCreateList(user.id, listName));
      }

      const targetList = (listName && listsByType.get(listName)) || defaultList;
      await addItemToList(item.id, targetList.id);
      if (item.status === 'planejado') await addItemToList(item.id, wishlist.id);
    }

    console.log(`Usuário ${user.id}: ${items.length} itens migrados.`);
  }

  const [lists, relationships, items] = await Promise.all([
    supabase.from('user_lists').select('*', { count: 'exact', head: true }),
    supabase.from('item_lists').select('*', { count: 'exact', head: true }),
    supabase.from('items').select('*', { count: 'exact', head: true })
  ]);
  for (const result of [lists, relationships, items]) {
    if (result.error) throw result.error;
  }

  console.log('Migração concluída.');
  console.log(`Listas: ${lists.count ?? 0}`);
  console.log(`Relacionamentos: ${relationships.count ?? 0}`);
  console.log(`Itens: ${items.count ?? 0}`);
}

migrateData().catch((error) => {
  console.error('Falha na migração:', error.message || error);
  process.exitCode = 1;
});
