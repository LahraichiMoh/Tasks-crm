# CRM Pro - SaaS CRM Application

A full-featured SaaS CRM application built with Next.js and Supabase.

## Features

- **Authentication**: JWT-based authentication with role-based access control
- **User Roles**: SUPER_ADMIN, ADMIN, EMPLOYEE, VIEWER
- **Dashboard**: Real-time analytics with charts
- **Leads Management**: Full CRUD with status tracking
- **Messaging**: Internal messaging system with broadcast capability
- **Activity Log**: Complete audit trail
- **i18n**: English, Arabic (RTL), French support
- **Responsive**: Mobile-friendly design

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Auth**: JWT with bcryptjs

## Getting Started

### 1. Clone and Install

```bash
npm install
# or
yarn install
```

### 2. Set Up Supabase

1. Create a new project at https://supabase.com
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Copy your project credentials from Settings > API

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-secure-jwt-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Visit http://localhost:3000

## Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@crm.com | password123 | SUPER_ADMIN |
| manager@crm.com | password123 | ADMIN |
| employee1@crm.com | password123 | EMPLOYEE |
| viewer@crm.com | password123 | VIEWER |

## Project Structure

```
├── app/
│   ├── api/[[...path]]/route.js  # API routes
│   ├── page.js                    # Main app
│   ├── layout.js                  # Root layout
│   └── globals.css                # Global styles
├── lib/
│   ├── supabase.js                # Supabase client
│   ├── auth-supabase.js           # Auth utilities
│   └── translations.js            # i18n translations
├── components/ui/                  # shadcn components
├── supabase-schema.sql            # Database schema
├── .env.example                   # Environment template
└── package.json
```

## API Endpoints

### Auth
- POST /api/auth/login - Login
- GET /api/auth/me - Get current user

### Leads
- GET /api/leads - List leads (paginated)
- POST /api/leads - Create lead
- GET /api/leads/:id - Get single lead
- PUT /api/leads/:id - Update lead
- PUT /api/leads/:id/status - Update lead status
- DELETE /api/leads/:id - Delete lead
- GET /api/leads/export - Export CSV

### Users
- GET /api/users - List users
- POST /api/users - Create user
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user

### Messages
- GET /api/messages - Get inbox/sent
- POST /api/messages - Send message

### Dashboard
- GET /api/dashboard/stats - Get statistics

### Activities
- GET /api/activities - Get activity log

## Role Permissions

| Feature | SUPER_ADMIN | ADMIN | EMPLOYEE | VIEWER |
|---------|-------------|-------|----------|--------|
| View Dashboard | Yes | Yes | Yes | Yes |
| Manage All Leads | Yes | Yes | No | No |
| Manage Assigned Leads | Yes | Yes | Yes | No |
| Create Users | Yes | Yes* | No | No |
| Delete Users | Yes | No | No | No |
| Broadcast Messages | Yes | No | No | No |
| View Activity Log | Yes | Yes | No | No |

*Admin can only create EMPLOYEE and VIEWER roles

## Deployment

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

## License

MIT
