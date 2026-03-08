A full-stack multi-event management platform built for organizers and participants — featuring real-time check-ins, team management, analytics, and email notifications.

### DEMO VIDEO
  https://drive.google.com/file/d/1Rvowd5kcXSQT8HihYbGafkyOfBJhwskn/view?usp=drivesdk

---
 ## Tech Stack

  Frontend   → Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui
  
  Backend    → Node.js, Express.js
  
  Database   → MongoDB + Mongoose
  
  Real-time  → Socket.io
  
  Auth       → JWT (access + refresh token, HTTP-only cookie)
  
  Email      → Resend API
  
  Charts     → Recharts
  
  State      → Zustand + TanStack React Query
  

  ---
  Key Features

  - Role-based access: Admin & Participant
  - Event creation with capacity limits, team config, and tags
  - Atomic registration — prevents double-booking under concurrent load
  - QR code ticket generation + live check-in scanner
  - Real-time socket updates for check-ins and notifications
  - Team management — invite via email, admin team assignment
  - Broadcast notifications (in-app / email)
  - Analytics dashboard — registration trends, check-in rates, status breakdown
  - CSV export of participant data

  ---
  Getting Started

  # Server
  cd server && npm install && npm run dev   # runs on :5000

  # Client
  cd client && npm install && npm run dev   # runs on :3002

  Env files needed

  server/.env  →  MONGODB_URI, JWT secrets, RESEND_API_KEY, CLIENT_URL
