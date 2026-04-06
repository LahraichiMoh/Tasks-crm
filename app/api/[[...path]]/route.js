import {
    NextResponse
} from 'next/server';
import {
    getSupabaseAdmin
} from '@/lib/supabase-admin';
import {
    hashPassword,
    verifyPassword,
    generateToken,
    getCurrentUser,
    ROLES
} from '@/lib/auth-supabase';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
    return NextResponse.json(data, {
        status,
        headers: corsHeaders
    });
}

function errorResponse(message, status = 400) {
    return NextResponse.json({
        error: message
    }, {
        status,
        headers: corsHeaders
    });
}

async function logActivity(userId, action, description, entityType, entityId) {
    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.from('activities').insert({
        user_id: userId,
        action,
        description,
        entity_type: entityType,
        entity_id: entityId
    });
}

async function getUserProjectIds(userId) {
    const supabaseAdmin = getSupabaseAdmin();
    const {
        data,
        error
    } = await supabaseAdmin
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map(r => r.project_id);
}

async function isUserInProject(userId, projectId) {
    const supabaseAdmin = getSupabaseAdmin();
    const {
        data,
        error
    } = await supabaseAdmin
        .from('project_members')
        .select('project_id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return !!data;
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: corsHeaders
    });
}

export async function GET(request) {
    const {
        pathname,
        searchParams
    } = new URL(request.url);
    const path = pathname.replace('/api', '');

    try {
        const supabaseAdmin = getSupabaseAdmin();
        // Health check
        if (path === '/health' || path === '/') {
            return jsonResponse({
                status: 'ok',
                timestamp: new Date().toISOString()
            });
        }

        if (path === '/seed') {
            if (process.env.NODE_ENV === 'production') {
                return errorResponse('Not found', 404);
            }

            const {
                count,
                error: countError
            } = await supabaseAdmin
                .from('users')
                .select('id', {
                    count: 'exact',
                    head: true
                });

            if (countError) throw countError;

            if ((count || 0) > 0) {
                return jsonResponse({
                    seeded: false
                });
            }

            const passwordHash = await hashPassword('password123');
            const {
                error: seedError
            } = await supabaseAdmin.from('users').insert([{
                    email: 'admin@crm.com',
                    password: passwordHash,
                    name: 'Super Admin',
                    role: 'SUPER_ADMIN'
                },
                {
                    email: 'manager@crm.com',
                    password: passwordHash,
                    name: 'John Manager',
                    role: 'ADMIN'
                },
                {
                    email: 'employee1@crm.com',
                    password: passwordHash,
                    name: 'Sarah Employee',
                    role: 'EMPLOYEE'
                },
                {
                    email: 'employee2@crm.com',
                    password: passwordHash,
                    name: 'Mike Sales',
                    role: 'EMPLOYEE'
                },
                {
                    email: 'viewer@crm.com',
                    password: passwordHash,
                    name: 'View Only User',
                    role: 'VIEWER'
                }
            ]);

            if (seedError) throw seedError;

            return jsonResponse({
                seeded: true
            });
        }

        // Get current user
        if (path === '/auth/me') {
            const user = await getCurrentUser(request);
            if (!user) return errorResponse('Unauthorized', 401);
            return jsonResponse({
                user
            });
        }

        if (path === '/projects') {
            const user = await getCurrentUser(request);
            if (!user) return errorResponse('Unauthorized', 401);

            let projectsQuery = supabaseAdmin.from('projects').select('*').order('created_at', {
                ascending: false
            });

            if (user.role === ROLES.EMPLOYEE || user.role === ROLES.VIEWER) {
                const projectIds = await getUserProjectIds(user.id);
                if (projectIds.length === 0) {
                    return jsonResponse({
                        items: []
                    });
                }
                projectsQuery = projectsQuery.in('id', projectIds);
            }

            const {
                data: projects,
                error: projectsError
            } = await projectsQuery;
            if (projectsError) throw projectsError;

            const projectIds = (projects || []).map(p => p.id);
            if (projectIds.length === 0) {
                return jsonResponse({
                    items: []
                });
            }

            const {
                data: memberships,
                error: membersError
            } = await supabaseAdmin
                .from('project_members')
                .select('project_id, user_id')
                .in('project_id', projectIds);

            if (membersError) throw membersError;

            const userIds = Array.from(new Set((memberships || []).map(m => m.user_id)));
            const {
                data: memberUsers,
                error: usersError
            } = userIds.length > 0 ?
                await supabaseAdmin
                .from('users')
                .select('id, name, role')
                .in('id', userIds) : {
                    data: [],
                    error: null
                };

            if (usersError) throw usersError;

            const userById = new Map((memberUsers || []).map(u => [u.id, u]));
            const membersByProject = new Map();
            (memberships || []).forEach(m => {
                const u = userById.get(m.user_id);
                if (!u) return;
                if (!membersByProject.has(m.project_id)) membersByProject.set(m.project_id, []);
                membersByProject.get(m.project_id).push({
                    id: u.id,
                    name: u.name,
                    role: u.role
                });
            });

            const items = (projects || []).map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                createdBy: p.created_by,
                updatedBy: p.updated_by,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                members: membersByProject.get(p.id) || []
            }));

            return jsonResponse({
                items
            });
        }

        // Dashboard stats
        if (path === '/dashboard/stats') {
            const user = await getCurrentUser(request);
            if (!user) return errorResponse('Unauthorized', 401);

            let query = supabaseAdmin.from('leads').select('*');

            if (user.role === ROLES.EMPLOYEE || user.role === ROLES.VIEWER) {
                const projectIds = await getUserProjectIds(user.id);
                if (projectIds.length > 0) {
                    query = query.or(`assigned_to.eq.${user.id},project_id.in.(${projectIds.join(',')})`);
                } else {
                    query = query.eq('assigned_to', user.id);
                }
            }

            const {
                data: allLeads,
                error
            } = await query;
            if (error) throw error;

            const totalLeads = (allLeads || []).length;
            const interested = (allLeads || []).filter(l => l.status === 'INTERESTED').length;
            const notInterested = (allLeads || []).filter(l => l.status === 'NOT_INTERESTED').length;
            const noAnswer = (allLeads || []).filter(l => l.status === 'NO_ANSWER').length;
            const phoneOff = (allLeads || []).filter(l => l.status === 'PHONE_OFF').length;
            const newLeads = (allLeads || []).filter(l => l.status === 'NEW').length;
            const male = (allLeads || []).filter(l => l.gender === 'MALE').length;
            const female = (allLeads || []).filter(l => l.gender === 'FEMALE').length;

            const conversionRate = totalLeads > 0 ? Math.round((interested / totalLeads) * 100) : 0;

            // Employee performance
            const {
                data: performance
            } = await supabaseAdmin
                .from('employee_performance')
                .select('*')
                .limit(10);

            const {
                count: totalUsers
            } = await supabaseAdmin
                .from('users')
                .select('*', {
                    count: 'exact',
                    head: true
                });

            return jsonResponse({
                totalLeads,
                interested,
                notInterested,
                noAnswer,
                phoneOff,
                newLeads,
                conversionRate,
                genderDistribution: {
                    male,
                    female
                },
                statusDistribution: [{
                        name: 'Interested',
                        value: interested
                    },
                    {
                        name: 'Not Interested',
                        value: notInterested
                    },
                    {
                        name: 'No Answer',
                        value: noAnswer
                    },
                    {
                        name: 'Phone Off',
                        value: phoneOff
                    },
                    {
                        name: 'New',
                        value: newLeads
                    }
                ],
                employeePerformance: (performance || []).map(p => ({
                    name: p.name,
                    total: p.total_leads,
                    interested: p.interested_leads,
                    conversionRate: p.conversion_rate
                })),
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
            const projectId = searchParams.get('projectId');
            const offset = (page - 1) * limit;

            let query = supabaseAdmin
                .from('leads_with_users')
                .select('*', {
                    count: 'exact'
                });

            if (projectId) {
                query = query.eq('project_id', projectId);
                if (user.role === ROLES.EMPLOYEE || user.role === ROLES.VIEWER) {
                    const allowed = await isUserInProject(user.id, projectId);
                    if (!allowed) return errorResponse('Access denied', 403);
                }
            } else if (user.role === ROLES.EMPLOYEE || user.role === ROLES.VIEWER) {
                const projectIds = await getUserProjectIds(user.id);
                if (projectIds.length > 0) {
                    query = query.or(`assigned_to.eq.${user.id},project_id.in.(${projectIds.join(',')})`);
                } else {
                    query = query.eq('assigned_to', user.id);
                }
            }

            if (status && status !== 'ALL') {
                query = query.eq('status', status);
            }

            if (search) {
                query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,city.ilike.%${search}%`);
            }

            const {
                data: items,
                count,
                error
            } = await query
                .order('created_at', {
                    ascending: false
                })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Transform to camelCase for frontend compatibility
            const transformedItems = (items || []).map(item => ({
                id: item.id,
                projectId: item.project_id,
                projectName: item.project_name,
                fullName: item.full_name,
                phone: item.phone,
                city: item.city,
                age: item.age,
                gender: item.gender,
                diploma: item.diploma,
                needs: item.needs,
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
            }));

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

            const projectId = searchParams.get('projectId');
            let query = supabaseAdmin
                .from('leads_with_users')
                .select('project_name, full_name, phone, city, age, gender, diploma, needs, status, notes, assigned_to_name, created_at');

            if (projectId) {
                query = query.eq('project_id', projectId);
                if (user.role === ROLES.EMPLOYEE || user.role === ROLES.VIEWER) {
                    const allowed = await isUserInProject(user.id, projectId);
                    if (!allowed) return errorResponse('Access denied', 403);
                }
            } else if (user.role === ROLES.EMPLOYEE || user.role === ROLES.VIEWER) {
                const projectIds = await getUserProjectIds(user.id);
                if (projectIds.length > 0) {
                    query = query.or(`assigned_to.eq.${user.id},project_id.in.(${projectIds.join(',')})`);
                } else {
                    query = query.eq('assigned_to', user.id);
                }
            }

            const {
                data: items,
                error
            } = await query.limit(10000);
            if (error) throw error;

            const headers = ['Project', 'Full Name', 'Phone', 'City', 'Age', 'Gender', 'Diploma', 'Needs', 'Status', 'Notes', 'Assigned To', 'Created At'];
            const rows = (items || []).map(l => [
                l.project_name || '',
                l.full_name,
                l.phone,
                l.city,
                l.age,
                l.gender,
                l.diploma || '',
                l.needs || '',
                l.status,
                l.notes || '',
                l.assigned_to_name || '',
                l.created_at
            ]);

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

            const {
                data: lead,
                error
            } = await supabaseAdmin
                .from('leads_with_users')
                .select('*')
                .eq('id', leadId)
                .single();

            if (error || !lead) return errorResponse('Lead not found', 404);

            if (user.role === ROLES.EMPLOYEE || user.role === ROLES.VIEWER) {
                const canSeeByAssignment = lead.assigned_to === user.id;
                const canSeeByProject = lead.project_id ? await isUserInProject(user.id, lead.project_id) : false;
                if (!canSeeByAssignment && !canSeeByProject) {
                    return errorResponse('Access denied', 403);
                }
            }

            return jsonResponse({
                id: lead.id,
                projectId: lead.project_id,
                projectName: lead.project_name,
                fullName: lead.full_name,
                phone: lead.phone,
                city: lead.city,
                age: lead.age,
                gender: lead.gender,
                diploma: lead.diploma,
                needs: lead.needs,
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

            const {
                data: items,
                error
            } = await supabaseAdmin
                .from('users')
                .select('id, email, name, role, created_at, updated_at')
                .limit(500);

            if (error) throw error;

            return jsonResponse({
                items: items || []
            });
        }

        // Get messages
        if (path === '/messages') {
            const user = await getCurrentUser(request);
            if (!user) return errorResponse('Unauthorized', 401);

            const {
                data: inbox
            } = await supabaseAdmin
                .from('messages_with_users')
                .select('*')
                .or(`to_id.eq.${user.id},is_broadcast.eq.true`)
                .order('created_at', {
                    ascending: false
                });

            const {
                data: sent
            } = await supabaseAdmin
                .from('messages_with_users')
                .select('*')
                .eq('from_id', user.id)
                .order('created_at', {
                    ascending: false
                });

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
                inbox: (inbox || []).map(transformMessage),
                sent: (sent || []).map(transformMessage)
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

            const {
                data: items,
                error
            } = await supabaseAdmin
                .from('activities_with_users')
                .select('*')
                .order('created_at', {
                    ascending: false
                })
                .limit(limit);

            if (error) throw error;

            const transformedItems = (items || []).map(a => ({
                id: a.id,
                userId: a.user_id,
                userName: a.user_name,
                action: a.action,
                description: a.description,
                entityType: a.entity_type,
                entityId: a.entity_id,
                createdAt: a.created_at
            }));

            return jsonResponse({
                items: transformedItems
            });
        }

        return errorResponse('Not found', 404);

    } catch (error) {
        console.error('API Error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}

export async function POST(request) {
    const {
        pathname
    } = new URL(request.url);
    const path = pathname.replace('/api', '');

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json().catch(() => ({}));

        // Login
        if (path === '/auth/login') {
            const {
                email,
                password
            } = body;
            if (!email || !password) {
                return errorResponse('Email and password required');
            }

            const {
                data: user,
                error
            } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return errorResponse('Invalid credentials', 401);
                }
                return errorResponse(error.message || 'Database error', 500);
            }

            if (!user) return errorResponse('Invalid credentials', 401);

            const storedPassword = String(user.password || '');
            const looksHashed = storedPassword.startsWith('$2') && storedPassword.length > 20;
            const isValid = looksHashed ? await verifyPassword(password, storedPassword) : password === storedPassword;
            if (!isValid) return errorResponse('Invalid credentials', 401);

            if (!looksHashed) {
                const upgradedHash = await hashPassword(password);
                await supabaseAdmin.from('users').update({
                    password: upgradedHash
                }).eq('id', user.id);
            }

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

            const {
                email,
                password,
                name,
                role
            } = body;
            const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
            const normalizedName = typeof name === 'string' ? name.trim() : '';
            if (!normalizedEmail || !password || !normalizedName || !role) {
                return errorResponse('All fields required');
            }

            if (currentUser.role === ROLES.VIEWER || currentUser.role === ROLES.EMPLOYEE) {
                return errorResponse('Access denied', 403);
            }

            if (currentUser.role === ROLES.ADMIN && (role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN)) {
                return errorResponse('Cannot create admin users', 403);
            }

            // Check if email exists
            const {
                data: existing,
                error: existingError
            } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (existingError) throw existingError;
            if (existing) return errorResponse('Email already exists');

            const hashedPassword = await hashPassword(password);

            const {
                data: newUser,
                error
            } = await supabaseAdmin
                .from('users')
                .insert({
                    email: normalizedEmail,
                    password: hashedPassword,
                    name: normalizedName,
                    role
                })
                .select('id, email, name, role, created_at, updated_at')
                .single();

            if (error) throw error;

            await logActivity(currentUser.id, 'USER_CREATED', `Created user: ${name}`, 'USER', newUser.id);

            return jsonResponse(newUser, 201);
        }

        if (path === '/projects') {
            const currentUser = await getCurrentUser(request);
            if (!currentUser) return errorResponse('Unauthorized', 401);

            if (currentUser.role !== ROLES.SUPER_ADMIN && currentUser.role !== ROLES.ADMIN) {
                return errorResponse('Access denied', 403);
            }

            const {
                name,
                description,
                memberIds
            } = body;

            if (!name) return errorResponse('Project name required', 400);

            const {
                data: project,
                error: projectError
            } = await supabaseAdmin
                .from('projects')
                .insert({
                    name,
                    description: description || null,
                    created_by: currentUser.id,
                    updated_by: currentUser.id
                })
                .select('*')
                .single();

            if (projectError) throw projectError;

            const members = Array.isArray(memberIds) ? memberIds : [];
            if (members.length > 0) {
                const {
                    data: users,
                    error: usersError
                } = await supabaseAdmin
                    .from('users')
                    .select('id, role')
                    .in('id', members);

                if (usersError) throw usersError;

                const allowedMemberIds = (users || [])
                    .filter(u => u.role === ROLES.EMPLOYEE)
                    .map(u => u.id);

                if (allowedMemberIds.length !== members.length) {
                    return errorResponse('Projects can only be assigned to employees', 400);
                }

                const inserts = allowedMemberIds.map(userId => ({
                    project_id: project.id,
                    user_id: userId,
                    added_by: currentUser.id
                }));

                const {
                    error: membersInsertError
                } = await supabaseAdmin.from('project_members').insert(inserts);

                if (membersInsertError) throw membersInsertError;
            }

            await logActivity(currentUser.id, 'PROJECT_CREATED', `Created project: ${name}`, 'PROJECT', project.id);

            return jsonResponse({
                id: project.id,
                name: project.name,
                description: project.description,
                createdAt: project.created_at,
                updatedAt: project.updated_at
            }, 201);
        }

        if (path === '/leads/import') {
            const currentUser = await getCurrentUser(request);
            if (!currentUser) return errorResponse('Unauthorized', 401);

            if (currentUser.role === ROLES.VIEWER) {
                return errorResponse('Access denied', 403);
            }

            const {
                projectId,
                assignedTo,
                leads
            } = body;

            if (!projectId) return errorResponse('Project required', 400);
            if (!Array.isArray(leads) || leads.length === 0) return errorResponse('Leads array required', 400);

            if (currentUser.role === ROLES.EMPLOYEE) {
                const allowed = await isUserInProject(currentUser.id, projectId);
                if (!allowed) return errorResponse('Access denied', 403);
            }

            const isAdmin = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.SUPER_ADMIN;

            if (isAdmin && !assignedTo) {
                const anyWithoutAssignee = leads.some(l => !l || !l.assignedTo);
                if (anyWithoutAssignee) return errorResponse('Assigned user required (set assignedTo or per-lead assignedTo)', 400);
            }

            if (!isAdmin && assignedTo && assignedTo !== currentUser.id) {
                return errorResponse('Access denied', 403);
            }

            const effectiveAssignedToByRow = leads.map(l => (l && l.assignedTo) || assignedTo || currentUser.id);
            const uniqueAssignees = Array.from(new Set(effectiveAssignedToByRow.filter(Boolean)));
            for (const userId of uniqueAssignees) {
                const member = await isUserInProject(userId, projectId);
                if (!member) return errorResponse('Assignee is not in this project', 400);
            }

            if (isAdmin && uniqueAssignees.length > 0) {
                const {
                    data: assignees,
                    error: assigneesError
                } = await supabaseAdmin
                    .from('users')
                    .select('id, role')
                    .in('id', uniqueAssignees);
                if (assigneesError) throw assigneesError;

                const roleById = new Map((assignees || []).map(u => [u.id, u.role]));
                for (const userId of uniqueAssignees) {
                    const role = roleById.get(userId);
                    if (!role) return errorResponse('Assigned user not found', 400);
                    if (currentUser.role === ROLES.ADMIN && role !== ROLES.EMPLOYEE) {
                        return errorResponse('Admin can only assign leads to employees', 403);
                    }
                    if (currentUser.role === ROLES.SUPER_ADMIN && role === ROLES.VIEWER) {
                        return errorResponse('Cannot assign leads to viewers', 403);
                    }
                }
            }

            const rows = leads.map((l, idx) => {
                const fullName = (l && l.fullName ? String(l.fullName).trim() : '');
                const phone = (l && l.phone ? String(l.phone).trim() : '');

                if (!fullName || !phone) {
                    throw new Error(`Row ${idx + 1}: fullName and phone required`);
                }

                const ageValue = l && l.age !== undefined && l.age !== null && String(l.age).trim() !== '' ? parseInt(l.age) : null;
                const genderValue = l && l.gender ? String(l.gender).toUpperCase() : 'MALE';
                const assigneeValue = (l && l.assignedTo) || assignedTo || currentUser.id;

                return {
                    project_id: projectId,
                    full_name: fullName,
                    phone,
                    city: l && l.city !== undefined ? (l.city ? String(l.city) : null) : null,
                    age: Number.isFinite(ageValue) ? ageValue : null,
                    gender: genderValue === 'FEMALE' ? 'FEMALE' : 'MALE',
                    diploma: l && l.diploma !== undefined ? (l.diploma ? String(l.diploma) : null) : null,
                    needs: l && l.needs !== undefined ? (l.needs ? String(l.needs) : null) : null,
                    status: 'NEW',
                    assigned_to: assigneeValue,
                    created_by: currentUser.id,
                    updated_by: currentUser.id
                };
            });

            const insertedIds = [];
            const chunkSize = 500;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const {
                    data: inserted,
                    error
                } = await supabaseAdmin
                    .from('leads')
                    .insert(chunk)
                    .select('id');
                if (error) throw error;
                (inserted || []).forEach(r => insertedIds.push(r.id));
            }

            await logActivity(currentUser.id, 'LEADS_IMPORTED', `Imported ${rows.length} leads`, 'PROJECT', projectId);

            return jsonResponse({
                success: true,
                inserted: insertedIds.length
            }, 201);
        }

        // Create lead
        if (path === '/leads') {
            const currentUser = await getCurrentUser(request);
            if (!currentUser) return errorResponse('Unauthorized', 401);

            if (currentUser.role === ROLES.VIEWER) {
                return errorResponse('Access denied', 403);
            }

            const {
                projectId,
                fullName,
                phone,
                city,
                age,
                gender,
                diploma,
                needs,
                assignedTo
            } = body;
            if (!projectId) return errorResponse('Project required', 400);
            if (!fullName || !phone) return errorResponse('Full name and phone required');

            if ((currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.SUPER_ADMIN) && !assignedTo) {
                return errorResponse('Assigned user required', 400);
            }

            if (currentUser.role === ROLES.EMPLOYEE) {
                const allowed = await isUserInProject(currentUser.id, projectId);
                if (!allowed) return errorResponse('Access denied', 403);
            }

            if (currentUser.role === ROLES.EMPLOYEE && assignedTo && assignedTo !== currentUser.id) {
                return errorResponse('Access denied', 403);
            }

            if (assignedTo && (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.SUPER_ADMIN)) {
                const {
                    data: assignee,
                    error: assigneeError
                } = await supabaseAdmin
                    .from('users')
                    .select('id, role')
                    .eq('id', assignedTo)
                    .single();

                if (assigneeError || !assignee) return errorResponse('Assigned user not found', 400);

                if (currentUser.role === ROLES.ADMIN && assignee.role !== ROLES.EMPLOYEE) {
                    return errorResponse('Admin can only assign leads to employees', 403);
                }

                if (currentUser.role === ROLES.SUPER_ADMIN && assignee.role === ROLES.VIEWER) {
                    return errorResponse('Cannot assign leads to viewers', 403);
                }
            }

            if (assignedTo) {
                const member = await isUserInProject(assignedTo, projectId);
                if (!member) return errorResponse('Assignee is not in this project', 400);
            }

            const {
                data: newLead,
                error
            } = await supabaseAdmin
                .from('leads')
                .insert({
                    project_id: projectId,
                    full_name: fullName,
                    phone,
                    city: city || null,
                    age: age ? parseInt(age) : null,
                    gender: gender || 'MALE',
                    diploma: diploma || null,
                    needs: needs || null,
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
                projectId: newLead.project_id,
                fullName: newLead.full_name,
                phone: newLead.phone,
                city: newLead.city,
                age: newLead.age,
                gender: newLead.gender,
                diploma: newLead.diploma,
                needs: newLead.needs,
                status: newLead.status,
                assignedTo: newLead.assigned_to,
                createdAt: newLead.created_at
            }, 201);
        }

        // Send message
        if (path === '/messages') {
            const currentUser = await getCurrentUser(request);
            if (!currentUser) return errorResponse('Unauthorized', 401);

            const {
                toId,
                subject,
                content,
                isBroadcast
            } = body;

            if (isBroadcast && currentUser.role !== ROLES.SUPER_ADMIN) {
                return errorResponse('Only Super Admin can broadcast', 403);
            }

            if (!isBroadcast && (!toId || !subject || !content)) {
                return errorResponse('Recipient, subject, and content required');
            }

            const {
                data: newMessage,
                error
            } = await supabaseAdmin
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
    const {
        pathname
    } = new URL(request.url);
    const path = pathname.replace('/api', '');

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const currentUser = await getCurrentUser(request);
        if (!currentUser) return errorResponse('Unauthorized', 401);

        const body = await request.json().catch(() => ({}));

        if (path.startsWith('/projects/') && path.split('/').length === 3) {
            const projectId = path.split('/')[2];

            if (currentUser.role !== ROLES.SUPER_ADMIN && currentUser.role !== ROLES.ADMIN) {
                return errorResponse('Access denied', 403);
            }

            const {
                name,
                description,
                memberIds
            } = body;

            const updateData = {
                ...(name && {
                    name
                }),
                ...(description !== undefined && {
                    description: description || null
                }),
                updated_by: currentUser.id
            };

            const {
                data: updatedProject,
                error: updateError
            } = await supabaseAdmin
                .from('projects')
                .update(updateData)
                .eq('id', projectId)
                .select('*')
                .single();

            if (updateError) throw updateError;

            if (Array.isArray(memberIds)) {
                const {
                    error: deleteError
                } = await supabaseAdmin
                    .from('project_members')
                    .delete()
                    .eq('project_id', projectId);

                if (deleteError) throw deleteError;

                if (memberIds.length > 0) {
                    const {
                        data: users,
                        error: usersError
                    } = await supabaseAdmin
                        .from('users')
                        .select('id, role')
                        .in('id', memberIds);

                    if (usersError) throw usersError;

                    const allowedMemberIds = (users || [])
                        .filter(u => u.role === ROLES.EMPLOYEE)
                        .map(u => u.id);

                    if (allowedMemberIds.length !== memberIds.length) {
                        return errorResponse('Projects can only be assigned to employees', 400);
                    }

                    const inserts = allowedMemberIds.map(userId => ({
                        project_id: projectId,
                        user_id: userId,
                        added_by: currentUser.id
                    }));

                    const {
                        error: insertError
                    } = await supabaseAdmin.from('project_members').insert(inserts);

                    if (insertError) throw insertError;
                }
            }

            await logActivity(currentUser.id, 'PROJECT_UPDATED', `Updated project: ${updatedProject.name}`, 'PROJECT', projectId);

            return jsonResponse({
                id: updatedProject.id,
                name: updatedProject.name,
                description: updatedProject.description,
                createdAt: updatedProject.created_at,
                updatedAt: updatedProject.updated_at
            });
        }

        // Update lead status
        if (path.startsWith('/leads/') && path.endsWith('/status')) {
            const leadId = path.split('/')[2];
            const {
                status,
                notes
            } = body;

            if (!status) return errorResponse('Status required');

            const {
                data: lead,
                error: fetchError
            } = await supabaseAdmin
                .from('leads')
                .select('*')
                .eq('id', leadId)
                .single();

            if (fetchError || !lead) return errorResponse('Lead not found', 404);

            if (currentUser.role === ROLES.EMPLOYEE) {
                const canSeeByAssignment = lead.assigned_to === currentUser.id;
                const canSeeByProject = lead.project_id ? await isUserInProject(currentUser.id, lead.project_id) : false;
                if (!canSeeByAssignment && !canSeeByProject) {
                    return errorResponse('Access denied', 403);
                }
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

            const {
                data: updatedLead,
                error
            } = await supabaseAdmin
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

            const {
                data: lead,
                error: fetchError
            } = await supabaseAdmin
                .from('leads')
                .select('*')
                .eq('id', leadId)
                .single();

            if (fetchError || !lead) return errorResponse('Lead not found', 404);

            if (currentUser.role === ROLES.VIEWER) {
                return errorResponse('Access denied', 403);
            }

            if (currentUser.role === ROLES.EMPLOYEE) {
                const canSeeByAssignment = lead.assigned_to === currentUser.id;
                const canSeeByProject = lead.project_id ? await isUserInProject(currentUser.id, lead.project_id) : false;
                if (!canSeeByAssignment && !canSeeByProject) {
                    return errorResponse('Access denied', 403);
                }
            }

            const {
                fullName,
                phone,
                city,
                age,
                gender,
                diploma,
                needs,
                notes,
                assignedTo
            } = body;

            if (currentUser.role === ROLES.EMPLOYEE && assignedTo && assignedTo !== currentUser.id) {
                return errorResponse('Access denied', 403);
            }

            if (assignedTo && (currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.SUPER_ADMIN)) {
                const {
                    data: assignee,
                    error: assigneeError
                } = await supabaseAdmin
                    .from('users')
                    .select('id, role')
                    .eq('id', assignedTo)
                    .single();

                if (assigneeError || !assignee) return errorResponse('Assigned user not found', 400);

                if (currentUser.role === ROLES.ADMIN && assignee.role !== ROLES.EMPLOYEE) {
                    return errorResponse('Admin can only assign leads to employees', 403);
                }

                if (currentUser.role === ROLES.SUPER_ADMIN && assignee.role === ROLES.VIEWER) {
                    return errorResponse('Cannot assign leads to viewers', 403);
                }
            }

            const updateData = {
                ...(fullName && {
                    full_name: fullName
                }),
                ...(phone && {
                    phone
                }),
                ...(city !== undefined && {
                    city
                }),
                ...(age !== undefined && {
                    age: age ? parseInt(age) : null
                }),
                ...(gender && {
                    gender
                }),
                ...(diploma !== undefined && {
                    diploma: diploma || null
                }),
                ...(needs !== undefined && {
                    needs: needs || null
                }),
                ...(notes !== undefined && {
                    notes
                }),
                ...(assignedTo && {
                    assigned_to: assignedTo
                }),
                updated_by: currentUser.id
            };

            const {
                data: updatedLead,
                error
            } = await supabaseAdmin
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

            const {
                data: user,
                error: fetchError
            } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (fetchError || !user) return errorResponse('User not found', 404);

            const {
                name,
                role,
                password
            } = body;

            const updateData = {
                ...(name && {
                    name
                }),
                ...(role && {
                    role
                })
            };

            if (password) {
                updateData.password = await hashPassword(password);
            }

            const {
                error
            } = await supabaseAdmin
                .from('users')
                .update(updateData)
                .eq('id', userId);

            if (error) throw error;

            await logActivity(currentUser.id, 'USER_UPDATED', `Updated user: ${name || user.name}`, 'USER', userId);

            return jsonResponse({
                id: userId,
                ...updateData
            });
        }

        // Mark message as read
        if (path.startsWith('/messages/') && path.endsWith('/read')) {
            const messageId = path.split('/')[2];

            await supabaseAdmin
                .from('messages')
                .update({
                    read: true
                })
                .eq('id', messageId);

            return jsonResponse({
                success: true
            });
        }

        return errorResponse('Not found', 404);

    } catch (error) {
        console.error('API Error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}

export async function DELETE(request) {
    const {
        pathname
    } = new URL(request.url);
    const path = pathname.replace('/api', '');

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const currentUser = await getCurrentUser(request);
        if (!currentUser) return errorResponse('Unauthorized', 401);

        if (path.startsWith('/projects/')) {
            const projectId = path.split('/')[2];

            if (currentUser.role !== ROLES.SUPER_ADMIN && currentUser.role !== ROLES.ADMIN) {
                return errorResponse('Access denied', 403);
            }

            const {
                data: project,
                error: fetchError
            } = await supabaseAdmin
                .from('projects')
                .select('name')
                .eq('id', projectId)
                .single();

            if (fetchError || !project) return errorResponse('Project not found', 404);

            const {
                error: deleteError
            } = await supabaseAdmin
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (deleteError) throw deleteError;

            await logActivity(currentUser.id, 'PROJECT_DELETED', `Deleted project: ${project.name}`, 'PROJECT', projectId);

            return jsonResponse({
                success: true
            });
        }

        // Delete lead
        if (path.startsWith('/leads/')) {
            const leadId = path.split('/')[2];

            if (currentUser.role === ROLES.VIEWER || currentUser.role === ROLES.EMPLOYEE) {
                return errorResponse('Access denied', 403);
            }

            const {
                data: lead,
                error: fetchError
            } = await supabaseAdmin
                .from('leads')
                .select('full_name')
                .eq('id', leadId)
                .single();

            if (fetchError || !lead) return errorResponse('Lead not found', 404);

            const {
                error
            } = await supabaseAdmin
                .from('leads')
                .delete()
                .eq('id', leadId);

            if (error) throw error;

            await logActivity(currentUser.id, 'LEAD_DELETED', `Deleted lead: ${lead.full_name}`, 'LEAD', leadId);

            return jsonResponse({
                success: true
            });
        }

        // Delete user
        if (path.startsWith('/users/')) {
            const userId = path.split('/')[2];

            if (currentUser.role !== ROLES.SUPER_ADMIN) {
                return errorResponse('Access denied', 403);
            }

            const {
                data: user,
                error: fetchError
            } = await supabaseAdmin
                .from('users')
                .select('name, role')
                .eq('id', userId)
                .single();

            if (fetchError || !user) return errorResponse('User not found', 404);

            if (userId === currentUser.id) {
                return errorResponse('Cannot delete yourself', 400);
            }

            const {
                error
            } = await supabaseAdmin
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            await logActivity(currentUser.id, 'USER_DELETED', `Deleted user: ${user.name}`, 'USER', userId);

            return jsonResponse({
                success: true
            });
        }

        return errorResponse('Not found', 404);

    } catch (error) {
        console.error('API Error:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}