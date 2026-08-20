/**
 * Script de Migração de Dados
 * Este script deve ser executado uma vez para migrar os dados existentes
 * para o novo sistema de listas customizáveis
 */

import { supabase } from '../src/lib/supabase.js';
import { createList, getOrCreateWishlist, addItemToList } from '../src/lib/lists.js';

async function migrateData() {
  console.log('🚀 Iniciando migração de dados...');
  
  try {
    // 1. Buscar todos os usuários
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    console.log(`📊 Encontrados ${users.length} usuários`);
    
    for (const user of users) {
      console.log(`\n👤 Processando usuário: ${user.email}`);
      
      // 2. Buscar itens do usuário
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id);
      
      if (itemsError) throw itemsError;
      console.log(`   📦 ${items.length} itens encontrados`);
      
      if (items.length === 0) continue;
      
      // 3. Determinar listas a criar baseado no usuário
      const isSpecificUser = user.email === 'ssy.igor@gmail.com';
      
      let animeList, animacaoList, serieList, defaultList;
      
      if (isSpecificUser) {
        // Criar listas específicas para ssy.igor@gmail.com
        console.log('   🎯 Criando listas específicas para usuário ssy.igor@gmail.com');
        
        try {
          animeList = await createList('Animes');
          console.log('   ✅ Lista "Animes" criada');
        } catch (e) {
          // Lista pode já existir
          const { data: existing } = await supabase
            .from('user_lists')
            .select('*')
            .eq('user_id', user.id)
            .eq('nome', 'Animes')
            .single();
          animeList = existing;
          console.log('   ℹ️  Lista "Animes" já existia');
        }
        
        try {
          animacaoList = await createList('Animações');
          console.log('   ✅ Lista "Animações" criada');
        } catch (e) {
          const { data: existing } = await supabase
            .from('user_lists')
            .select('*')
            .eq('user_id', user.id)
            .eq('nome', 'Animações')
            .single();
          animacaoList = existing;
          console.log('   ℹ️  Lista "Animações" já existia');
        }
        
        try {
          serieList = await createList('Séries');
          console.log('   ✅ Lista "Séries" criada');
        } catch (e) {
          const { data: existing } = await supabase
            .from('user_lists')
            .select('*')
            .eq('user_id', user.id)
            .eq('nome', 'Séries')
            .single();
          serieList = existing;
          console.log('   ℹ️  Lista "Séries" já existia');
        }
      } else {
        // Criar "Minha Lista" para outros usuários
        console.log('   🎯 Criando "Minha Lista" para usuário padrão');
        
        try {
          defaultList = await createList('Minha Lista');
          console.log('   ✅ Lista "Minha Lista" criada');
        } catch (e) {
          const { data: existing } = await supabase
            .from('user_lists')
            .select('*')
            .eq('user_id', user.id)
            .eq('nome', 'Minha Lista')
            .single();
          defaultList = existing;
          console.log('   ℹ️  Lista "Minha Lista" já existia');
        }
      }
      
      // 4. Criar Lista de Desejos para todos
      const wishlist = await getOrCreateWishlist();
      console.log('   ✅ Lista de Desejos garantida');
      
      // 5. Migrar itens para as listas correspondentes
      console.log('   🔄 Migrando itens para as listas...');
      
      for (const item of items) {
        let targetListId;
        
        if (isSpecificUser) {
          // Mapear por tipo para usuário específico
          switch (item.tipo) {
            case 'anime':
              targetListId = animeList?.id;
              break;
            case 'animacao':
              targetListId = animacaoList?.id;
              break;
            case 'serie':
              targetListId = serieList?.id;
              break;
            default:
              targetListId = defaultList?.id;
          }
        } else {
          // Adicionar à "Minha Lista" para outros usuários
          targetListId = defaultList?.id;
        }
        
        // Adicionar à lista principal
        if (targetListId) {
          try {
            await addItemToList(item.id, targetListId);
          } catch (e) {
            console.log(`   ⚠️  Item "${item.nome}" já estava na lista`);
          }
        }
        
        // Se for planejado, adicionar também à Lista de Desejos
        if (item.status === 'planejado') {
          try {
            await addItemToList(item.id, wishlist.id);
          } catch (e) {
            console.log(`   ⚠️  Item "${item.nome}" já estava na Lista de Desejos`);
          }
        }
      }
      
      console.log(`   ✅ Migração concluída para usuário ${user.email}`);
    }
    
    // 6. Verificação final
    const { count: totalLists } = await supabase
      .from('user_lists')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalRelationships } = await supabase
      .from('item_lists')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalItems } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });
    
    console.log('\n🎉 Migração concluída com sucesso!');
    console.log(`📊 Estatísticas finais:`);
    console.log(`   - Total de listas: ${totalLists}`);
    console.log(`   - Total de relacionamentos: ${totalRelationships}`);
    console.log(`   - Total de itens: ${totalItems}`);
    
  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    throw error;
  }
}

// Executar migração
migrateData()
  .then(() => {
    console.log('✅ Processo de migração finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha na migração:', error);
    process.exit(1);
  });