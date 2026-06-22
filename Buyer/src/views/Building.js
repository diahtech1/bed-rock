import { databases, account, DB_ID, COL_BUILDING, COL_ROOM, COL_BOOKING, COL_REVIEW, COL_BUYER, syncSavedItem } from '../appwrite.js';

export default class Building {
    constructor(params) {
        document.title = "Bedrock | Building";
        this.buildingId = params.id;
        this.building = null;
        this.rooms = [];
        this.isLoggedIn = false;
        this.buyerId = null;
        this.savedBuildingIds = [];
        this.savedRoomIds = [];
    }

    async render() {
        return `
            <div id="building-container">
                <div style="text-align:center;">Loading Building Details...</div>
            </div>
        `;
    }

    async mounted() {
        await this.loadData();
    }

    async loadData() {
        try {
            this.building = await databases.getDocument(DB_ID, COL_BUILDING, this.buildingId);
            const dynamicBc = document.getElementById('dynamic-breadcrumb');
            if (dynamicBc) dynamicBc.textContent = this.building.Name;
            
            const { Query } = await import('appwrite');
            const roomsResponse = await databases.listDocuments(DB_ID, COL_ROOM, [
                Query.equal('Building', this.buildingId),
                Query.limit(100)
            ]);
            this.rooms = roomsResponse.documents.filter(r => r.Status !== 'Closed');

            try {
                const user = await account.get();
                this.isLoggedIn = true;
                this.buyerId = user.prefs ? user.prefs.buyerId : null;
            } catch (e) {
                this.isLoggedIn = false;
            }

            // Load saved state from localStorage
            try {
                const bSaved = localStorage.getItem('bedrock_saved_buildings');
                if (bSaved) this.savedBuildingIds = JSON.parse(bSaved);
                const rSaved = localStorage.getItem('bedrock_saved_rooms');
                if (rSaved) this.savedRoomIds = JSON.parse(rSaved);
            } catch(e) {}

            try {
                // Force fetch bookings to bypass stale relationship hydration and 25-item limits
                const bookingsResponse = await databases.listDocuments(DB_ID, COL_BOOKING, [
                    Query.limit(1000)
                ]);
                const allBookings = bookingsResponse.documents;
                
                // Keep only relevant bookings for this building's rooms OR this building itself
                const roomIds = this.rooms.map(r => r.$id);
                const relevantBookings = allBookings.filter(b => {
                    const bRoomId = typeof b.Room === 'object' && b.Room !== null ? b.Room.$id : b.Room;
                    const bBldgId = typeof b.Building === 'object' && b.Building !== null ? b.Building.$id : b.Building;
                    return roomIds.includes(bRoomId) || bBldgId === this.buildingId;
                });
                
                // Hydrate Reviews and Buyers concurrently for relevant bookings only
                await Promise.all(relevantBookings.map(async b => {
                    const promises = [];
                    if (typeof b.Review === 'string') {
                        promises.push(databases.getDocument(DB_ID, COL_REVIEW, b.Review).then(rev => b.Review = rev).catch(e => {}));
                    }
                    if (typeof b.Buyer === 'string') {
                        promises.push(databases.getDocument(DB_ID, COL_BUYER, b.Buyer).then(buy => b.Buyer = buy).catch(e => {}));
                    }
                    await Promise.all(promises);
                }));
                
                this.rooms.forEach(r => {
                    r.Bookings = relevantBookings.filter(b => {
                        const bRoomId = typeof b.Room === 'object' && b.Room !== null ? b.Room.$id : b.Room;
                        return bRoomId === r.$id;
                    });

                    // Privacy: scrub buyer details if not logged in
                    if (!this.isLoggedIn && r.Bookings) {
                        r.Bookings = r.Bookings.map(b => ({ ...b, Buyer: null }));
                    }
                });
            } catch (bookingErr) {
                console.warn("Could not fetch full bookings list.", bookingErr);
            }

            this.renderBuilding();
        } catch (err) {
            console.error(err);
            document.getElementById('building-container').innerHTML = `<div style="color:var(--danger);">Failed to load building data.</div>`;
        }
    }

    renderBuilding() {
        const container = document.getElementById('building-container');
        let imgUrl = (this.building.Pictures && this.building.Pictures.length > 0) ? this.building.Pictures[0] : 'https://via.placeholder.com/1200x400?text=No+Image';
        if (imgUrl.includes('appwrite.io') && !imgUrl.includes('project=')) {
            imgUrl += (imgUrl.includes('?') ? '&' : '?') + 'project=bedrock';
        }
        
        const now = new Date();
        
        // Calculate room statuses
        this.rooms.forEach(room => {
            room.isBooked = false;
            if (room.Bookings && room.Bookings.length > 0) {
                room.isBooked = room.Bookings.some(booking => {
                    const start = new Date(booking.StartDate);
                    const end = new Date(booking.EndDate);
                    return now >= start && now <= end;
                });
            }

            // Determine UI Status based on Administrative Status and Bookings
            room.status = "Available";
            room.statusColor = "var(--success)";
            
            if (room.Status === 'Closed') {
                room.status = "Closed";
                room.statusColor = "var(--danger)";
            } else if (room.isBooked) {
                room.status = "Booked";
                room.statusColor = "var(--danger)";
            }

            // Calculate average rating
            let totalRating = 0;
            let ratingCount = 0;
            if (room.Bookings && room.Bookings.length > 0) {
                room.Bookings.forEach(booking => {
                    if (booking.Review && booking.Review.Rating) {
                        totalRating += booking.Review.Rating;
                        ratingCount++;
                    }
                });
            }
            room.averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 'No Reviews';
        });

        // Sort by Booking Status (Not Booked - Booked)
        this.rooms.sort((a, b) => (a.isBooked === b.isBooked) ? 0 : a.isBooked ? 1 : -1);

        let roomsHtml = this.rooms.length === 0 ? `<p>No rooms available in this building.</p>` : this.rooms.map(room => {
            const isRoomSaved = this.savedRoomIds.includes(room.$id);
            const roomHeart = isRoomSaved ? 
                `<svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
                `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
            return `
            <div class="card" id="room-${room.$id}" style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: center; transition: border 0.3s ease;">
                <div style="flex: 1; min-width: 250px; position: relative;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <h3 style="font-size: 1.5rem;">${room.RoomName}</h3>
                        <button class="btn-like-room" data-id="${room.$id}" data-saved="${isRoomSaved}" style="background: transparent; border: none; cursor: pointer; padding: 0.25rem; display: flex; align-items: center; justify-content: center; transition: transform 0.2s;">
                            ${roomHeart}
                        </button>
                    </div>
                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; color: ${room.statusColor}">
                        ${room.status}
                    </div>
                    <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                        Beds: ${room.NbrBeds || 0} | Bathrooms: ${room.NbrBathrooms || 0} | Max Occupants: ${room.MaxOccupants || 0}
                    </p>
                    <p style="font-size: 0.9rem; margin-bottom: 1rem;">${room.Details || ''}</p>
                    <p style="font-size: 1.25rem; color: var(--accent); font-weight: 700;">₦${(room.RoomPrice || 0).toLocaleString()} <span style="font-size: 0.8rem; opacity: 0.8; font-weight: 500; color: var(--text-secondary);">/ ${this.building.LeasingPeriod || 'period'}</span></p>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    ${this.isLoggedIn ? `<button class="btn btn-view-bookings" data-id="${room.$id}" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary);">View Bookings</button>` : ''}
                    <button class="btn btn-view-reviews" data-id="${room.$id}" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary);">★ ${room.averageRating}</button>
                    ${room.Status === 'Closed' ? `<button class="btn" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary); cursor: not-allowed; opacity: 0.6;" disabled>Closed</button>` : `<button class="btn btn-book" data-id="${room.$id}">Book</button>`}
                </div>
            </div>
        `}).join('');

        const isBuildingSaved = this.savedBuildingIds.includes(this.buildingId);
        const buildingHeart = isBuildingSaved ? 
            `<svg fill="currentColor" viewBox="0 0 24 24" width="28" height="28" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
            `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;

        container.innerHTML = `
            <div id="building-hero-img" style="height: 300px; background: url('${imgUrl}') center/cover; border-radius: 1rem; margin-bottom: 2rem; cursor: pointer;" title="Click to view all pictures"></div>
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                <h1 style="font-size: 2.5rem; color: var(--accent); margin: 0;">${this.building.Name}</h1>
                <button id="btn-like-building" data-saved="${isBuildingSaved}" style="background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; color: var(--text-primary); cursor: pointer; transition: transform 0.2s;">
                    ${buildingHeart}
                </button>
            </div>
            <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 2rem;">${this.building.Address} &bull; ${this.building.Type}</p>
            
            ${this.building.Details && this.building.Details.trim().length > 0 ? `
            <div style="margin-bottom: 2rem; padding: 1.5rem; border-radius: 1rem; background: var(--bg-secondary); border: 1px solid var(--glass-border);">
                <h3 style="font-size: 1.2rem; margin-bottom: 0.75rem; color: var(--text-primary);">About this Building</h3>
                <p style="color: var(--text-secondary); white-space: pre-wrap; font-size: 1rem; line-height: 1.5;">${this.building.Details}</p>
            </div>
            ` : ''}

            ${this.building.Type === 'Hall' ? `
            <div class="card" style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; align-items: center;">
                <div style="flex: 1; min-width: 250px;">
                    <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">${this.building.Name} Booking</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                        Max Occupants: ${this.building.MaxOccupants || 0}
                    </p>
                    <p style="font-size: 1.25rem; color: var(--accent); font-weight: 700;">₦${(this.building.Price || 0).toLocaleString()} <span style="font-size: 0.8rem; opacity: 0.8; font-weight: 500; color: var(--text-secondary);">/ ${this.building.LeasingPeriod || 'period'}</span></p>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-book-hall" style="padding: 0.75rem 2rem; font-size: 1.1rem;">Book Hall</button>
                </div>
            </div>
            ` : `
            <h2 style="font-size: 1.75rem; margin-bottom: 1.5rem;">Rooms</h2>
            <div>${roomsHtml}</div>
            `}
        `;

        // Attach Event Listeners
        import('../components/Modals.js').then(m => {
            const heroImg = document.getElementById('building-hero-img');
            if (heroImg) {
                heroImg.addEventListener('click', () => {
                    m.openLightboxGallery(this.building.Pictures || []);
                });
            }

            container.querySelectorAll('.btn-view-bookings').forEach(btn => {
                btn.addEventListener('click', () => {
                    const room = this.rooms.find(r => r.$id === btn.getAttribute('data-id'));
                    m.openBookingsModal(room);
                });
            });
            container.querySelectorAll('.btn-view-reviews').forEach(btn => {
                btn.addEventListener('click', () => {
                    const room = this.rooms.find(r => r.$id === btn.getAttribute('data-id'));
                    m.openReviewsModal(room);
                });
            });
            container.querySelectorAll('.btn-book').forEach(btn => {
                btn.addEventListener('click', () => {
                    const room = this.rooms.find(r => r.$id === btn.getAttribute('data-id'));
                    m.openBookModal(room, this.building);
                });
            });
            const btnBookHall = container.querySelector('.btn-book-hall');
            if (btnBookHall) {
                btnBookHall.addEventListener('click', () => {
                    m.openBookModal(null, this.building);
                });
            }
        });

        // Like Building Toggle
        const btnLikeBuilding = document.getElementById('btn-like-building');
        if (btnLikeBuilding) {
            btnLikeBuilding.addEventListener('click', () => {
                const isSaved = btnLikeBuilding.getAttribute('data-saved') === 'true';
                const newSavedState = !isSaved;
                
                // Optimistic UI
                btnLikeBuilding.setAttribute('data-saved', newSavedState.toString());
                btnLikeBuilding.innerHTML = newSavedState ? 
                    `<svg fill="currentColor" viewBox="0 0 24 24" width="28" height="28" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
                    `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
                
                try {
                    let savedArray = [];
                    const saved = localStorage.getItem('bedrock_saved_buildings');
                    if (saved) savedArray = JSON.parse(saved);

                    if (newSavedState) {
                        if (!savedArray.includes(this.buildingId)) savedArray.push(this.buildingId);
                        this.savedBuildingIds.push(this.buildingId);
                        syncSavedItem('building', this.buildingId, 'add');
                    } else {
                        savedArray = savedArray.filter(id => id !== this.buildingId);
                        this.savedBuildingIds = this.savedBuildingIds.filter(id => id !== this.buildingId);
                        syncSavedItem('building', this.buildingId, 'remove');
                    }
                    localStorage.setItem('bedrock_saved_buildings', JSON.stringify(savedArray));
                } catch (e) {
                    console.error("Failed to toggle building save", e);
                }
            });
        }

        // Like Room Toggles
        container.querySelectorAll('.btn-like-room').forEach(btn => {
            btn.addEventListener('click', () => {
                const roomId = btn.getAttribute('data-id');
                const isSaved = btn.getAttribute('data-saved') === 'true';
                const newSavedState = !isSaved;

                // Optimistic UI
                btn.setAttribute('data-saved', newSavedState.toString());
                btn.innerHTML = newSavedState ? 
                    `<svg fill="currentColor" viewBox="0 0 24 24" width="20" height="20" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
                    `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
                
                try {
                    let savedArray = [];
                    const saved = localStorage.getItem('bedrock_saved_rooms');
                    if (saved) savedArray = JSON.parse(saved);

                    if (newSavedState) {
                        if (!savedArray.includes(roomId)) savedArray.push(roomId);
                        this.savedRoomIds.push(roomId);
                        syncSavedItem('room', roomId, 'add');
                    } else {
                        savedArray = savedArray.filter(id => id !== roomId);
                        this.savedRoomIds = this.savedRoomIds.filter(id => id !== roomId);
                        syncSavedItem('room', roomId, 'remove');
                    }
                    localStorage.setItem('bedrock_saved_rooms', JSON.stringify(savedArray));
                } catch (e) {
                    console.error("Failed to toggle room save", e);
                }
            });
        });

        // Scroll to specific room if hash exists
        if (location.hash && location.hash.startsWith('#room-')) {
            setTimeout(() => {
                const el = document.getElementById(location.hash.substring(1));
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.style.border = "2px solid var(--accent)";
                }
            }, 100);
        }
    }
}
