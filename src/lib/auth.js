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
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: Object, session: Object}>}
 */
export async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Desconecta o usuário do Supabase.
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
