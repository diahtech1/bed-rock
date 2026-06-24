<div align="center">
  <h1>🪨 Bedrock</h1>
  <p><em>Streamlining Property Management & Leasing in Redemption City</em></p>
  <p><strong>Team Talabi Josiah's Entry for Kingdom Hack</strong></p>
</div>

<br />

## 📖 About The Project

Bedrock is a comprehensive dual-interface property management and booking platform built specifically for the residents and property administrators of **Redemption City**. It eliminates the friction associated with finding, verifying, and booking leases, while giving property managers powerful tools to oversee their assets seamlessly.

Whether you're looking for a hostel, a hotel room, a hall for an event, or an apartment, Bedrock handles the entire leasing lifecycle with an elegant, modern, and lightning-fast user interface.

## ✨ Features

### 🛒 For Buyers (Renters/Users)
- **Extensive Catalogue:** Browse buildings with rich filtering (price, beds, baths, occupants) and sorting (availability, price, alphabetical, rating).
- **Optimistic Saved Items:** Instantly "Like" buildings and rooms. Your saved items are synced to the cloud seamlessly in the background and accessible from a dedicated dashboard.
- **Secure Bookings:** Add payment cards to your wallet and book leases (daily, monthly, yearly) with automatic overlap detection.
- **Reviews & Ratings:** Leave reviews for completed bookings and view community ratings for transparency.
- **Rich Media & Galleries:** Immerse yourself in properties with swipeable, responsive lightbox image galleries.
- **Dark/Light Mode:** Full aesthetic control customized to your viewing preferences.

### 🏢 For Property Admins (PAdmin)
- **Property Management:** Add, edit, and delete buildings (Hostels, Hotels, Halls, Apartments).
- **Room Management:** Bulk-add rooms, define capacities, prices, and amenities.
- **Booking Oversight:** View full calendar and list-based logs of all bookings linked to your properties.
- **Dashboard:** A bird's eye view of all managed assets in a clean, responsive layout.

## 🚀 Upcoming Future Updates
We are constantly expanding Bedrock's capabilities. Our roadmap includes:
- **Proximity Sorting:** Find buildings sorted by their distance to key locations.
- **AI Chat bot:** A smart assistant to guide users and answer queries instantly.
- **Report Parsing & Generation (Admin):** Extract data from property reports and generate financial/occupancy metrics with one click.
- **Manual Booking Confirmation (Admin):** Optional manual review step for incoming bookings.

## 🛠️ Tech Stack
- **Frontend Core:** Vanilla HTML, CSS, JavaScript
- **Styling:** Custom-built Glassmorphism UI, fully responsive
- **Build Tool:** [Vite](https://vitejs.dev/) / [Bun](https://bun.sh/)
- **Backend as a Service (BaaS):** [Appwrite](https://appwrite.io/) (Authentication, Database, Storage)
- **Routing:** Custom client-side SPA router
- **Date/Calendar:** Flatpickr & FullCalendar

## ⚙️ Quick Start

To run the project locally, you will need to start both the Buyer and PAdmin interfaces. Ensure you have Node.js or Bun installed.

### 1. Clone the repository
```bash
git clone https://github.com/your-username/bed-rock.git
cd bed-rock
```

### 2. Run the Buyer Interface
```bash
cd Buyer
npm install   # or bun install
npm run dev   # or bun run dev
```

### 3. Run the PAdmin Interface
```bash
# In a separate terminal instance
cd PAdmin
npm install   # or bun install
npm run dev   # or bun run dev
```

### 4. Configuration
Ensure your Appwrite endpoint and Project IDs are correctly configured in `src/appwrite.js` for both environments before interacting with the database.

## 🤝 Team
- **Team Talabi Josiah** - Developers & Designers for Kingdom Hack.

---
*Built with ❤️ for Kingdom Hack*
