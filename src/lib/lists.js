/**
 * Funções para gerenciar listas customizáveis de usuários
 * Sistema de listas many-to-many entre itens e listas
 */

import { supabase } from './supabase.js';

/**
 * Busca todas as listas de um usuário
 * @returns {Promise<Array>} Lista de listas do usuário
 */
export async function fetchUserLists() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('user_lists')
    .select('*')
    .eq('user_id', user.id)
    .order('ordem', { ascending: true });
  
  if (error) {
    console.error('Erro ao buscar listas:', error);
    throw new Error(`Erro ao buscar listas: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Cria uma nova lista para o usuário
 * @param {string} nome - Nome da lista
 * @param {boolean} isSystem - Se é uma lista do sistema (ex: Lista de Desejos)
 * @returns {Promise<Object>} Lista criada
 */
export async function createList(nome, isSystem = false) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não logado.');
  
  // Buscar maior ordem atual para definir a próxima
  const { data: existingLists } = await supabase
    .from('user_lists')
    .select('ordem')
    .eq('user_id', user.id)
    .order('ordem', { ascending: false })
    .limit(1);
  
  const nextOrder = existingLists && existingLists.length > 0 
    ? (existingLists[0].ordem || 0) + 1 
    : 0;
  
  const { data, error } = await supabase
    .from('user_lists')
    .insert([{ 
      user_id: user.id, 
      nome, 
      is_system: isSystem,
      ordem: nextOrder
    }])
    .select();
  
  if (error) {
    console.error('Erro ao criar lista:', error);
    throw new Error(`Erro ao criar lista: ${error.message}`);
  }
  
  return data[0];
}

/**
 * Renomeia uma lista existente
 * @param {string} listId - ID da lista
 * @param {string} novoNome - Novo nome da lista
 * @returns {Promise<Object>} Lista atualizada
 */
export async function renameList(listId, novoNome) {
  const { data, error } = await supabase
    .from('user_lists')
    .update({ nome: novoNome })
    .eq('id', listId)
    .select();
  
  if (error) {
    console.error('Erro ao renomear lista:', error);
    throw new Error(`Erro ao renomear lista: ${error.message}`);
  }
  
  return data[0];
}

/**
 * Deleta uma lista (se não for do sistema)
 * @param {string} listId - ID da lista
 * @returns {Promise<void>}
 */
export async function deleteList(listId) {
  const { data: listData } = await supabase
    .from('user_lists')
    .select('is_system')
    .eq('id', listId)
    .single();
  
  if (listData?.is_system) {
    throw new Error('Não é possível deletar listas do sistema.');
  }
  
  const { error: relError } = await supabase
    .from('item_lists')
    .delete()
    .eq('list_id', listId);
  
  if (relError) {
    console.error('Erro ao remover relacionamentos da lista:', relError);
    throw new Error(`Erro ao remover itens da lista: ${relError.message}`);
  }
  
  const { error } = await supabase
    .from('user_lists')
    .delete()
    .eq('id', listId);
  
  if (error) {
    console.error('Erro ao deletar lista:', error);
    throw new Error(`Erro ao deletar lista: ${error.message}`);
  }
}

/**
 * Adiciona um item a uma lista
 * @param {string} itemId - ID do item
 * @param {string} listId - ID da lista
 * @returns {Promise<Object>} Relacionamento criado
 */
export async function addItemToList(itemId, listId) {
  const { data, error } = await supabase
    .from('item_lists')
    .insert([{ item_id: itemId, list_id: listId }])
    .select();
  
  if (error) {
    // Se já existe o relacionamento, não é erro
    if (error.code === '23505') { // unique violation
      return null;
    }
    console.error('Erro ao adicionar item à lista:', error);
    throw new Error(`Erro ao adicionar item à lista: ${error.message}`);
  }
  
  return data[0];
}

/**
 * Remove um item de uma lista
 * @param {string} itemId - ID do item
 * @param {string} listId - ID da lista
 * @returns {Promise<void>}
 */
export async function removeItemFromList(itemId, listId) {
  const { error } = await supabase
    .from('item_lists')
    .delete()
    .eq('item_id', itemId)
    .eq('list_id', listId);
  
  if (error) {
    console.error('Erro ao remover item da lista:', error);
    throw new Error(`Erro ao remover item da lista: ${error.message}`);
  }
}

/**
 * Busca todas as listas de um item específico
 * @param {string} itemId - ID do item
 * @returns {Promise<Array>} Lista de listas do item
 */
export async function fetchListsForItem(itemId) {
  const { data, error } = await supabase
    .from('item_lists')
    .select('list_id, user_lists(*)')
    .eq('item_id', itemId);
  
  if (error) {
    console.error('Erro ao buscar listas do item:', error);
    throw new Error(`Erro ao buscar listas do item: ${error.message}`);
  }
  
  return data?.map(il => il.user_lists) || [];
}

/**
 * Atualiza a ordem das listas
 * @param {Array<{id: string, ordem: number}>} lists - Array com id e nova ordem
 * @returns {Promise<void>}
 */
export async function updateListsOrder(lists) {
  const updates = lists.map(({ id, ordem }) => 
    supabase.from('user_lists').update({ ordem }).eq('id', id)
  );
  
  const results = await Promise.allSettled(updates);
  const failures = results.filter(r => r.status === 'rejected');
  
  if (failures.length > 0) {
    console.error('Falhas ao atualizar ordem:', failures);
    throw new Error(`${failures.length} de ${lists.length} atualizações falharam`);
  }
}

/**
 * Busca ou cria a lista de desejos do sistema para o usuário
 * @returns {Promise<Object>} Lista de desejos
 */
export async function getOrCreateWishlist() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não logado.');
  
  // Tenta buscar a lista de desejos existente
  const { data: existingWishlist } = await supabase
    .from('user_lists')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_system', true)
    .eq('nome', 'Lista de Desejos')
    .single();
  
  if (existingWishlist) {
    return existingWishlist;
  }
  
  // Se não existe, cria
  return await createList('Lista de Desejos', true);
}