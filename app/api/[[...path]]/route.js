import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, verifyPassword, generateToken, getCurrentUser, ROLES } from '@/lib/auth-supabase';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders });
}

async function logActivity(userId, action, description, entityType, entityId) {
  await supabaseAdmin.from('activities').insert({
    user_id: userId,
    action,
    description,
    entity_type: entityType,
    entity_id: entityId
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request) {
  const { pathname, searchParams } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    // Health check
    if (path === '/health' || path === '/') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Get current user
    if (path === '/auth/me') {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);
      return jsonResponse({ user });
    }

    // Dashboard stats
    if (path === '/dashboard/stats') {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);

      let query = supabaseAdmin.from('leads').select('*');
      
      if (user.role === ROLES.EMPLOYEE) {
        query = query.eq('assigned_to', user.id);
      }

      const { data: allLeads, error } = await query;
      if (error) throw error;

      const totalLeads = allLeads?.length || 0;
      const interested = allLeads?.filter(l => l.status === 'INTERESTED').length || 0;
      const notInterested = allLeads?.filter(l => l.status === 'NOT_INTERESTED').length || 0;
      const noAnswer = allLeads?.filter(l => l.status === 'NO_ANSWER').length || 0;
      const phoneOff = allLeads?.filter(l => l.status === 'PHONE_OFF').length || 0;
      const newLeads = allLeads?.filter(l => l.status === 'NEW').length || 0;
      const male = allLeads?.filter(l => l.gender === 'MALE').length || 0;
      const female = allLeads?.filter(l => l.gender === 'FEMALE').length || 0;

      const conversionRate = totalLeads > 0 ? Math.round((interested / totalLeads) * 100) : 0;

      // Employee performance
      const { data: performance } = await supabaseAdmin
        .from('employee_performance')
        .select('*')
        .limit(10);

      const { count: totalUsers } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      return jsonResponse({
        totalLeads,
        interested,
        notInterested,
        noAnswer,
        phoneOff,
        newLeads,
        conversionRate,
        genderDistribution: { male, female },
        statusDistribution: [
          { name: 'Interested', value: interested },
          { name: 'Not Interested', value: notInterested },
          { name: 'No Answer', value: noAnswer },
          { name: 'Phone Off', value: phoneOff },
          { name: 'New', value: newLeads }
        ],
        employeePerformance: performance?.map(p => ({
          name: p.name,
          total: p.total_leads,
          interested: p.interested_leads,
          conversionRate: p.conversion_rate
        })) || [],
        totalUsers: totalUsers || 0
      });
    }

    // Get leads
    if (path === '/leads') {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);

      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('leads_with_users')
        .select('*', { count: 'exact' });

      if (user.role === ROLES.EMPLOYEE) {
        query = query.eq('assigned_to', user.id);
      }

      if (status && status !== 'ALL') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,city.ilike.%${search}%`);
      }

      const { data: items, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Transform to camelCase for frontend compatibility
      const transformedItems = items?.map(item => ({
        id: item.id,
        fullName: item.full_name,
        phone: item.phone,
        city: item.city,
        age: item.age,
        gender: item.gender,
        status: item.status,
        notes: item.notes,
        assignedTo: item.assigned_to,
        assignedToName: item.assigned_to_name,
        createdBy: item.created_by,
        createdByName: item.created_by_name,
        updatedBy: item.updated_by,
        updatedByName: item.updated_by_name,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })) || [];

      return jsonResponse({
        items: transformedItems,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      });
    }

    // Export leads as CSV
    if (path === '/leads/export') {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);

      let query = supabaseAdmin
        .from('leads_with_users')
        .select('full_name, phone, city, age, gender, status, notes, assigned_to_name, created_at');

      if (user.role === ROLES.EMPLOYEE) {
        query = query.eq('assigned_to', user.id);
      }

      const { data: items, error } = await query.limit(10000);
      if (error) throw error;

      const headers = ['Full Name', 'Phone', 'City', 'Age', 'Gender', 'Status', 'Notes', 'Assigned To', 'Created At'];
      const rows = items?.map(l => [
        l.full_name,
        l.phone,
        l.city,
        l.age,
        l.gender,
        l.status,
        l.notes || '',
        l.assigned_to_name || '',
        l.created_at
      ]) || [];

      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=leads.csv'
        }
      });
    }

    // Get single lead
    if (path.startsWith('/leads/') && path.split('/').length === 3) {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);

      const leadId = path.split('/')[2];
      
      const { data: lead, error } = await supabaseAdmin
        .from('leads_with_users')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error || !lead) return errorResponse('Lead not found', 404);

      if (user.role === ROLES.EMPLOYEE && lead.assigned_to !== user.id) {
        return errorResponse('Access denied', 403);
      }

      return jsonResponse({
        id: lead.id,
        fullName: lead.full_name,
        phone: lead.phone,
        city: lead.city,
        age: lead.age,
        gender: lead.gender,
        status: lead.status,
        notes: lead.notes,
        assignedTo: lead.assigned_to,
        assignedToName: lead.assigned_to_name,
        createdAt: lead.created_at,
        updatedAt: lead.updated_at
      });
    }

    // Get users
    if (path === '/users') {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);
      if (user.role === ROLES.VIEWER || user.role === ROLES.EMPLOYEE) {
        return errorResponse('Access denied', 403);
      }

      const { data: items, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, role, created_at, updated_at')
        .limit(500);

      if (error) throw error;

      return jsonResponse({ items: items || [] });
    }

    // Get messages
    if (path === '/messages') {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);

      const { data: inbox } = await supabaseAdmin
        .from('messages_with_users')
        .select('*')
        .or(`to_id.eq.${user.id},is_broadcast.eq.true`)
        .order('created_at', { ascending: false });

      const { data: sent } = await supabaseAdmin
        .from('messages_with_users')
        .select('*')
        .eq('from_id', user.id)
        .order('created_at', { ascending: false });

      const transformMessage = (m) => ({
        id: m.id,
        fromId: m.from_id,
        fromName: m.from_name,
        toId: m.to_id,
        toName: m.to_name,
        subject: m.subject,
        content: m.content,
        isBroadcast: m.is_broadcast,
        read: m.read,
        createdAt: m.created_at
      });

      return jsonResponse({
        inbox: inbox?.map(transformMessage) || [],
        sent: sent?.map(transformMessage) || []
      });
    }

    // Get activities
    if (path === '/activities') {
      const user = await getCurrentUser(request);
      if (!user) return errorResponse('Unauthorized', 401);
      if (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.ADMIN) {
        return errorResponse('Access denied', 403);
      }

      const limit = parseInt(searchParams.get('limit') || '50');

      const { data: items, error } = await supabaseAdmin
        .from('activities_with_users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const transformedItems = items?.map(a => ({
        id: a.id,
        userId: a.user_id,
        userName: a.user_name,
        action: a.action,
        description: a.description,
        entityType: a.entity_type,
        entityId: a.entity_id,
        createdAt: a.created_at
      })) || [];

      return jsonResponse({ items: transformedItems });
    }

    return errorResponse('Not found', 404);

  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    const body = await request.json().catch(() => ({}));

    // Login
    if (path === '/auth/login') {
      const { email, password } = body;
      if (!email || !password) {
        return errorResponse('Email and password required');
      }

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) return errorResponse('Invalid credentials', 401);

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) return errorResponse('Invalid credentials', 401);

      const token = generateToken(user);

      await logActivity(user.id, 'LOGIN', 'User logged in', 'USER', user.id);

      return jsonResponse({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    }

    // Create user
    if (path === '/users') {
      const currentUser = await getCurrentUser(request);
      if (!currentUser) return errorResponse('Unauthorized', 401);

      const { email, password, name, role } = body;
      if (!email || !password || !name || !role) {
        return errorResponse('All fields required');
      }

      if (currentUser.role === ROLES.VIEWER || currentUser.role === ROLES.EMPLOYEE) {
        return errorResponse('Access denied', 403);
      }

      if (currentUser.role === ROLES.ADMIN && (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN)) {
        return errorResponse('Cannot create admin users', 403);
      }

      // Check if email exists
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) return errorResponse('Email already exists');

      const hashedPassword = await hashPassword(password);

      const { data: newUser, error } = await supabaseAdmin
        .from('users')
        .insert({
          email,
          password: hashedPassword,
          name,
          role
        })
        .select('id, email, name, role, created_at, updated_at')
        .single();

      if (error) throw error;

      await logActivity(currentUser.id, 'USER_CREATED', `Created user: ${name}`, 'USER', newUser.id);

      return jsonResponse(newUser, 201);
    }

    // Create lead
    if (path === '/leads') {
      const currentUser = await getCurrentUser(request);
      if (!currentUser) return errorResponse('Unauthorized', 401);

      if (currentUser.role === ROLES.VIEWER) {
        return errorResponse('Access denied', 403);
      }

      const { fullName, phone, city, age, gender, assignedTo } = body;
      if (!fullName || !phone) {
        return errorResponse('Full name and phone required');
      }

      const { data: newLead, error } = await supabaseAdmin
        .from('leads')
        .insert({
          full_name: fullName,
          phone,
          city: city || null,
          age: age ? parseInt(age) : null,
          gender: gender || 'MALE',
          status: 'NEW',
          assigned_to: assignedTo || currentUser.id,
          created_by: currentUser.id,
          updated_by: currentUser.id
        })
        .select('*')
        .single();

      if (error) throw error;

      await logActivity(currentUser.id, 'LEAD_CREATED', `Created lead: ${fullName}`, 'LEAD', newLead.id);

      return jsonResponse({
        id: newLead.id,
        fullName: newLead.full_name,
        phone: newLead.phone,
        city: newLead.city,
        age: newLead.age,
        gender: newLead.gender,
        status: newLead.status,
        assignedTo: newLead.assigned_to,
        createdAt: newLead.created_at
      }, 201);
    }

    // Send message
    if (path === '/messages') {
      const currentUser = await getCurrentUser(request);
      if (!currentUser) return errorResponse('Unauthorized', 401);

      const { toId, subject, content, isBroadcast } = body;

      if (isBroadcast && currentUser.role !== ROLES.SUPER_ADMIN) {
        return errorResponse('Only Super Admin can broadcast', 403);
      }

      if (!isBroadcast && (!toId || !subject || !content)) {
        return errorResponse('Recipient, subject, and content required');
      }

      const { data: newMessage, error } = await supabaseAdmin
        .from('messages')
        .insert({
          from_id: currentUser.id,
          to_id: isBroadcast ? null : toId,
          subject,
          content,
          is_broadcast: isBroadcast || false
        })
        .select('*')
        .single();

      if (error) throw error;

      await logActivity(
        currentUser.id,
        'MESSAGE_SENT',
        isBroadcast ? 'Broadcast message sent' : 'Message sent',
        'MESSAGE',
        newMessage.id
      );

      return jsonResponse(newMessage, 201);
    }

    return errorResponse('Not found', 404);

  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function PUT(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return errorResponse('Unauthorized', 401);

    const body = await request.json().catch(() => ({}));

    // Update lead status
    if (path.startsWith('/leads/') && path.endsWith('/status')) {
      const leadId = path.split('/')[2];
      const { status, notes } = body;

      if (!status) return errorResponse('Status required');

      const { data: lead, error: fetchError } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) return errorResponse('Lead not found', 404);

      if (currentUser.role === ROLES.EMPLOYEE && lead.assigned_to !== currentUser.id) {
        return errorResponse('Access denied', 403);
      }

      if (currentUser.role === ROLES.VIEWER) {
        return errorResponse('Access denied', 403);
      }

      const updateData = {
        status,
        updated_by: currentUser.id
      };

      if (status === 'INTERESTED' && notes) {
        updateData.notes = notes;
      }

      const { data: updatedLead, error } = await supabaseAdmin
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select('*')
        .single();

      if (error) throw error;

      await logActivity(currentUser.id, 'LEAD_STATUS_UPDATED', `Updated lead status to ${status}`, 'LEAD', leadId);

      return jsonResponse(updatedLead);
    }

    // Update lead
    if (path.startsWith('/leads/') && path.split('/').length === 3) {
      const leadId = path.split('/')[2];

      const { data: lead, error: fetchError } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) return errorResponse('Lead not found', 404);

      if (currentUser.role === ROLES.VIEWER) {
        return errorResponse('Access denied', 403);
      }

      if (currentUser.role === ROLES.EMPLOYEE && lead.assigned_to !== currentUser.id) {
        return errorResponse('Access denied', 403);
      }

      const { fullName, phone, city, age, gender, notes, assignedTo } = body;

      const updateData = {
        ...(fullName && { full_name: fullName }),
        ...(phone && { phone }),
        ...(city !== undefined && { city }),
        ...(age !== undefined && { age: age ? parseInt(age) : null }),
        ...(gender && { gender }),
        ...(notes !== undefined && { notes }),
        ...(assignedTo && { assigned_to: assignedTo }),
        updated_by: currentUser.id
      };

      const { data: updatedLead, error } = await supabaseAdmin
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select('*')
        .single();

      if (error) throw error;

      await logActivity(currentUser.id, 'LEAD_UPDATED', `Updated lead: ${fullName || lead.full_name}`, 'LEAD', leadId);

      return jsonResponse(updatedLead);
    }

    // Update user
    if (path.startsWith('/users/') && path.split('/').length === 3) {
      const userId = path.split('/')[2];

      if (currentUser.role === ROLES.VIEWER || currentUser.role === ROLES.EMPLOYEE) {
        return errorResponse('Access denied', 403);
      }

      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !user) return errorResponse('User not found', 404);

      const { name, role, password } = body;

      const updateData = {
        ...(name && { name }),
        ...(role && { role })
      };

      if (password) {
        updateData.password = await hashPassword(password);
      }

      const { error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      await logActivity(currentUser.id, 'USER_UPDATED', `Updated user: ${name || user.name}`, 'USER', userId);

      return jsonResponse({ id: userId, ...updateData });
    }

    // Mark message as read
    if (path.startsWith('/messages/') && path.endsWith('/read')) {
      const messageId = path.split('/')[2];

      await supabaseAdmin
        .from('messages')
        .update({ read: true })
        .eq('id', messageId);

      return jsonResponse({ success: true });
    }

    return errorResponse('Not found', 404);

  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

export async function DELETE(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '');

  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) return errorResponse('Unauthorized', 401);

    // Delete lead
    if (path.startsWith('/leads/')) {
      const leadId = path.split('/')[2];

      if (currentUser.role === ROLES.VIEWER || currentUser.role === ROLES.EMPLOYEE) {
        return errorResponse('Access denied', 403);
      }

      const { data: lead, error: fetchError } = await supabaseAdmin
        .from('leads')
        .select('full_name')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) return errorResponse('Lead not found', 404);

      const { error } = await supabaseAdmin
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      await logActivity(currentUser.id, 'LEAD_DELETED', `Deleted lead: ${lead.full_name}`, 'LEAD', leadId);

      return jsonResponse({ success: true });
    }

    // Delete user
    if (path.startsWith('/users/')) {
      const userId = path.split('/')[2];

      if (currentUser.role !== ROLES.SUPER_ADMIN) {
        return errorResponse('Access denied', 403);
      }

      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (fetchError || !user) return errorResponse('User not found', 404);

      if (userId === currentUser.id) {
        return errorResponse('Cannot delete yourself', 400);
      }

      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await logActivity(currentUser.id, 'USER_DELETED', `Deleted user: ${user.name}`, 'USER', userId);

      return jsonResponse({ success: true });
    }

    return errorResponse('Not found', 404);

  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
