import { supabase } from './supabase.js';

/**
 * Verifica se há uma sessão ativa no Supabase Auth.
 * @returns {Promise<Object|null>} Objeto de sessão ou null se deslogado.
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    return null;
  }
}

/**
 * Retorna o usuário logado atualmente.
 * @returns {Promise<Object|null>} Objeto do usuário ou null.
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    return null;
  }
}

/**
 * Realiza o login com email e senha.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: Object, session: Object}>}
 */
export async function loginWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Realiza o cadastro com email e senha.
 * `displayName` vai para `user_metadata.full_name`, que é de onde o menu do
 * usuário tira nome e iniciais — não há tabela `profiles` no projeto.
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 * @returns {Promise<{user: Object, session: Object|null}>}
 */
export async function signUpWithPassword(email, password, displayName) {
  const options = displayName
    ? { data: { full_name: displayName } }
    : undefined;
  const { data, error } = await supabase.auth.signUp({ email, password, options });
  if (error) throw error;
  return data;
}

/**
 * Atualiza o nome de exibição do usuário logado.
 * @param {string} displayName
 * @returns {Promise<Object>} o usuário atualizado
 */
export async function updateDisplayName(displayName) {
  const { data, error } = await supabase.auth.updateUser({
    data: { full_name: displayName },
  });
  if (error) throw error;
  return data.user;
}

/**
 * Logout removido — morto (main.js usa supabase.auth.signOut direto).
 */
