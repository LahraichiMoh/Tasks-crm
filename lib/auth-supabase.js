import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

if (!JWT_SECRET) {
  console.error('WARNING: JWT_SECRET environment variable is not set!');
}

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
  VIEWER: 'VIEWER'
};

export const PERMISSIONS = {
  SUPER_ADMIN: ['all'],
  ADMIN: ['create_employee', 'manage_projects', 'view_leads', 'view_analytics', 'send_messages'],
  EMPLOYEE: ['update_lead_status', 'add_notes', 'view_assigned_leads', 'send_messages'],
  VIEWER: ['view_leads', 'view_analytics']
};

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) return null;
  
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role')
    .eq('id', decoded.id)
    .single();
  
  if (error || !user) return null;
  
  return user;
}

export function hasPermission(userRole, permission) {
  if (userRole === ROLES.SUPER_ADMIN) return true;
  return PERMISSIONS[userRole]?.includes(permission) || false;
}

export function canManageRole(currentRole, targetRole) {
  const roleHierarchy = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    EMPLOYEE: 2,
    VIEWER: 1
  };
  return roleHierarchy[currentRole] > roleHierarchy[targetRole];
}
