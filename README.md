## swaras-music-app

A modern, full-stack music streaming application that enables users to discover, upload, and manage their favorite tracks. Built with cutting-edge technologies including Next.js 14, Clerk authentication, and Prisma, Swaras provides a seamless music experience with robust content management capabilities.

**_Landing Page_**

![Landing Page](./public/LandingPage.png)

---

**_Admin Page_**

![Admin Dashboard](./public/Admin.png)

---

## Overview

Swaras is a feature-rich music streaming platform with role-based access control. Admin users can upload songs with automatic metadata extraction, while regular users enjoy playing tracks, creating playlists, and liking their favorite songs. The application prioritizes security, scalability, and user experience.

---

## 🎯 Core Features

### User Features
- 🎧 **Advanced Music Playback** – Custom audio player with intuitive controls (volume, progress tracking, seek functionality)
- 🔐 **Secure Authentication** – Clerk authentication with multiple sign-in methods (email/password, OAuth)
- ❤️ **Liked Songs** – Save favorite tracks for quick access
- 📋 **Playlist Management** – Create, edit, and organize playlists
- 🎼 **Song Discovery** – Browse and search through available music
- 📱 **Responsive Design** – Optimized for desktop, tablet, and mobile devices

### Admin Features
- ⬆️ **Song Upload** – Upload music files with automatic metadata extraction
- 🏷️ **Metadata Management** – Define song title, artist, album, and cover art
- ☁️ **Cloud Storage** – Seamless Cloudinary integration for reliable file hosting
- 🔒 **Role-Based Access Control** – Secure admin-only routes and operations

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router) – Modern React framework with server-side rendering
- **TypeScript** – Type-safe development
- **Tailwind CSS** – Utility-first CSS framework
- **React Context API** – Global state management for audio
- **Axios** – HTTP client for API requests

### Backend & Database
- **Next.js API Routes** – Serverless backend functions
- **Prisma ORM** – Type-safe database access with migrations
- **PostgreSQL** – Relational database (via Prisma)

### Authentication & Security
- **Clerk** – Complete user management and authentication
- **Role-based access control** – Admin and user roles

### Third-Party Services
- **Cloudinary** – Media hosting and CDN
- **Resend** – Transactional email service

### Notifications & UX
- **react-hot-toast** – Toast notifications
- **react-email** – Email template rendering

---

## 📋 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL database
- Clerk account (for authentication)
- Cloudinary account
- Resend API key (optional, for email)

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/sutharrahul/swaras-music-app.git
cd swaras-music-app
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/swaras"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
CLERK_SECRET_KEY="your-clerk-secret-key"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
CLOUDINARY_URL="cloudinary://your-credentials"

# Email Service (Resend)
RESEND_API_KEY="your-resend-api-key"

# Admin Configuration
ADMIN_EMAIL="admin@example.com"
```

#### 4. Setup Database

```bash
# Run Prisma migrations
npx prisma migrate dev

# (Optional) Seed the database
npm run db:seed
```

#### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (auth)/            # Authentication pages
│   ├── admin/             # Admin dashboard
│   ├── playlist/          # Playlist pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── MusicPlayer.tsx    # Audio player component
│   ├── Navbar.tsx         # Navigation
│   └── ui/                # Reusable UI components
├── context/               # React Context
│   └── SongContextProvider.tsx
├── hook/                  # Custom React hooks
├── lib/                   # Utility functions
│   ├── prisma.ts         # Prisma client
│   ├── cloudinary.ts     # Cloudinary setup
│   └── axiosApiRequest.ts # API request wrapper
├── model/                 # Data models
└── types/                 # TypeScript types

prisma/
├── schema.prisma          # Database schema
└── migrations/            # Database migrations
```

---

## 🔍 Key Features Explained

### Authentication Flow
1. Users sign up using Clerk's authentication UI
2. Multiple sign-in methods supported (email/password, OAuth providers, magic links)
3. Clerk manages user sessions and security
4. Email verification handled by Clerk
5. Protected routes use Clerk middleware
6. Role-based access control for admin features

### Music Upload Pipeline
1. Admin uploads song file via Cloudinary uploader
2. Automatic metadata extraction (title, artist, album)
3. Cover art processing and optimization
4. Data stored in PostgreSQL via Prisma
5. File served through Cloudinary CDN

### Playlist Management
- Users create and name playlists
- Add/remove songs from playlists
- Playlists associated with user accounts
- All changes persisted to database

### Audio State Management
- Global state using React Context
- Current song, playback status, queue
- Controls: play, pause, skip, volume
- Persistent player across navigation

---

## 📡 API Endpoints

### Authentication
- Handled by Clerk (authentication endpoints managed by Clerk)
- User data synced with database via webhooks

### Songs
- `GET /api/get-songs` – Fetch all songs
- `POST /api/admin/upload-song` – Upload song (admin only)
- `DELETE /api/delete-song` – Delete song (admin only)

### Playlists
- `GET /api/get-playlist` – Fetch user playlists
- `POST /api/post-playlist` – Create playlist
- `PUT /api/update-playlist` – Update playlist
- `DELETE /api/delete-playlist` – Delete playlist

### Likes
- `POST /api/like-song` – Like/unlike song
- `GET /api/get-liked-songs` – Fetch liked songs

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm run build
# Deploy to Vercel
vercel deploy
```

### Docker
```bash
docker build -t swaras-music-app .
docker run -p 3000:3000 swaras-music-app
```

### Environment Setup for Production
- Configure Clerk production instance
- Add production domain to Clerk dashboard
- Configure Cloudinary for production
- Use PostgreSQL production database
- Enable HTTPS
- Set up Clerk webhooks for user sync

---

## 🧪 Testing

```bash
# Run linting
npm run lint

# Type checking
npm run type-check

# Build verification
npm run build
```

---

---

## 🛣️ Roadmap

### Completed
✅ Core music playback functionality
✅ User authentication and authorization
✅ Admin upload system
✅ Playlist management
✅ Like/favorite songs
✅ Responsive UI design

### In Progress
🔄 Advanced search and filtering
🔄 User profiles and settings

### Planned
📋 Social features (share playlists, recommendations)
📋 Offline playback support
📋 Equalizer and audio effects
📋 Podcast support
📋 Multi-language support

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License – see the LICENSE file for details.

---

## 👨‍💻 Author

**Rahul Suthar**
- GitHub: [@sutharrahul](https://github.com/sutharrahul)
- LinkedIn: [suthar-rahul](https://www.linkedin.com/in/suthar-rahul/)
- Email: [Contact](mailto:your-email@example.com)

---

## 🆘 Support & Issues

Found a bug or have a feature request? Please open an issue on [GitHub Issues](https://github.com/sutharrahul/swaras-music-app/issues).

---

**Last Updated:** January 2026

---
