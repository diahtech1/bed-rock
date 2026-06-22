import { account, databases, DB_ID, COL_BOOKING, COL_BUILDING, COL_BUYER, COL_ROOM, COL_REVIEW } from '../appwrite.js';
import { navigateTo } from '../main.js';

export default class Bookings {
    constructor() {
        document.title = "Bedrock | My Bookings";
        this.buyerId = null;
        this.bookings = [];
        this.featuredBuildings = [];
    }

    async render() {
        return `
            <div style="max-width: 1000px; margin: 0 auto; padding: 2rem 0;">
                <h1 style="color: var(--accent); margin-bottom: 2rem; font-size: 2.5rem;">My Dashboard</h1>
                
                <h2 style="margin-bottom: 1rem; font-size: 1.5rem; color: var(--text-primary);">Your Bookings</h2>
                <div id="bookings-container" style="margin-bottom: 3rem;">
                    <div style="text-align:center; padding: 2rem;">Loading bookings...</div>
                </div>

                <h2 style="margin-bottom: 1rem; font-size: 1.5rem; color: var(--text-primary);">Browse Accommodations</h2>
                <div id="featured-buildings" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div style="text-align:center; padding: 2rem; grid-column: 1 / -1;">Loading featured buildings...</div>
                </div>
                
                <div style="text-align: center; margin-bottom: 2rem;">
                    <a href="/catalogue" class="btn" style="padding: 0.75rem 3rem;" data-link>Browse Full Catalog</a>
                </div>
            </div>
        `;
    }

    async mounted() {
        try {
            const user = await account.get();
            let buyerId = user.prefs && user.prefs.buyerId;
            if (!buyerId) {
                const { Query } = await import('appwrite');
                const buyers = await databases.listDocuments(DB_ID, COL_BUYER, [Query.equal('Email', user.email)]);
                if (buyers.documents.length > 0) {
                    buyerId = buyers.documents[0].$id;
                } else {
                    throw new Error("Not a buyer account");
                }
            }
            this.buyerId = buyerId;

            await this.loadData();
        } catch (err) {
            console.error("Bookings load error", err);
            navigateTo('/login');
        }
    }

    async loadData() {
        try {
            const { Query } = await import('appwrite');
            // Load bookings
            const bookingsRes = await databases.listDocuments(DB_ID, COL_BOOKING, [
                Query.equal('Buyer', this.buyerId),
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);
            this.bookings = bookingsRes.documents;
            
            for (let b of this.bookings) {
                if (typeof b.Room === 'string') {
                    try {
                        b.Room = await databases.getDocument(DB_ID, COL_ROOM, b.Room);
                    } catch(e) {}
                }
                if (b.Room && typeof b.Room.Building === 'string') {
                    try {
                        b.Room.Building = await databases.getDocument(DB_ID, COL_BUILDING, b.Room.Building);
                    } catch(e) {}
                }
                if (typeof b.Review === 'string') {
                    try {
                        b.Review = await databases.getDocument(DB_ID, COL_REVIEW, b.Review);
                    } catch(e) {}
                }
            }

            this.bookings.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
            
            this.renderBookings();

            // Load 5 random buildings
            const [buildingsRes, roomsRes, allBookingsRes, reviewsRes] = await Promise.all([
                databases.listDocuments(DB_ID, COL_BUILDING),
                databases.listDocuments(DB_ID, COL_ROOM, [Query.limit(1000)]),
                databases.listDocuments(DB_ID, COL_BOOKING, [Query.limit(1000)]),
                databases.listDocuments(DB_ID, COL_REVIEW, [Query.limit(1000)])
            ]);
            const allBuildings = buildingsRes.documents;
            const allRooms = roomsRes.documents;
            const allBookings = allBookingsRes.documents;
            const allReviews = reviewsRes.documents;

            const shuffled = allBuildings.sort(() => 0.5 - Math.random());
            this.featuredBuildings = shuffled.slice(0, 5).map(b => {
                const bRooms = allRooms.filter(r => r.Building && (r.Building.$id === b.$id || r.Building === b.$id));
                b.roomCount = bRooms.length;
                
                let availableCount = 0;
                let totalPrice = 0;
                const now = new Date();
                bRooms.forEach(room => {
                    let isBooked = false;
                    const roomBookings = allBookings.filter(bk => {
                        const rId = typeof bk.Room === 'object' && bk.Room !== null ? bk.Room.$id : bk.Room;
                        return rId === room.$id;
                    });
                    if (roomBookings.length > 0) {
                        isBooked = roomBookings.some(booking => {
                            const start = new Date(booking.StartDate);
                            const end = new Date(booking.EndDate);
                            return now >= start && now <= end;
                        });
                    }
                    if (!isBooked) {
                        availableCount++;
                        totalPrice += room.RoomPrice || 0;
                    }
                });
                b.availableRoomsCount = availableCount;
                b.averageAvailablePrice = availableCount > 0 ? (totalPrice / availableCount) : 0;

                // Calculate Reviews
                const roomIds = bRooms.map(r => r.$id);
                const bBookingsForReviews = allBookings.filter(bk => {
                    const rId = (typeof bk.Room === 'object' && bk.Room !== null) ? bk.Room.$id : bk.Room;
                    return roomIds.includes(rId);
                });
                const bookingIds = bBookingsForReviews.map(bk => bk.$id);
                const bReviews = allReviews.filter(r => {
                    const bkId = (typeof r.Booking === 'object' && r.Booking !== null) ? r.Booking.$id : r.Booking;
                    return bookingIds.includes(bkId);
                });
                
                b.reviewCount = bReviews.length;
                if (bReviews.length > 0) {
                    const sum = bReviews.reduce((acc, r) => acc + (r.Rating || 0), 0);
                    b.averageRating = sum / bReviews.length;
                } else {
                    b.averageRating = null;
                }
                
                return b;
            });

            this.renderFeaturedBuildings();
        } catch (err) {
            console.error("Failed to load dashboard data", err);
            document.getElementById('bookings-container').innerHTML = `<div style="color:var(--danger); padding:2rem;">Failed to load data.</div>`;
        }
    }

    renderBookings() {
        const container = document.getElementById('bookings-container');
        
        if (this.bookings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                    <h3 style="margin-bottom: 1rem; color: var(--text-primary);">You have no bookings yet.</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">Find the perfect room and secure it instantly!</p>
                    <a href="/catalogue" class="btn" data-link>Create Booking</a>
                </div>
            `;
            return;
        }

        const tableRows = this.bookings.map(b => {
            const roomName = b.Room ? b.Room.RoomName : 'Unknown Room';
            const buildingName = (b.Room && b.Room.Building) ? b.Room.Building.Name : 'Unknown Building';
            const buildingId = (b.Room && b.Room.Building) ? b.Room.Building.$id : null;
            
            // Format dates nicely, e.g. "Oct 12 - Oct 15, 2026"
            const startObj = new Date(b.StartDate);
            const endObj = new Date(b.EndDate);
            const startStr = startObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const endStr = endObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const dateRange = `${startStr} - ${endStr}`;
            
            const bLink = buildingId ? `<a href="/building/${buildingId}" data-link style="color: var(--text-primary); font-weight: 700; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-primary)'">${buildingName}</a>` : buildingName;
            
            const now = new Date();
            
            let statusBadge = '';
            let isPast = false;
            if (now < startObj) {
                statusBadge = `<span style="font-size:0.75rem; background:rgba(37,99,235,0.1); color:var(--accent); padding:0.3rem 0.8rem; border-radius:2rem; font-weight:700; text-transform: uppercase; letter-spacing: 0.5px;">Upcoming</span>`;
            } else if (now >= startObj && now <= endObj) {
                statusBadge = `<span style="font-size:0.75rem; background:rgba(22,163,74,0.1); color:var(--success); padding:0.3rem 0.8rem; border-radius:2rem; font-weight:700; text-transform: uppercase; letter-spacing: 0.5px;">Active</span>`;
            } else {
                isPast = true;
                statusBadge = `<span style="font-size:0.75rem; background:var(--bg-color); border:1px solid var(--glass-border); color:var(--text-secondary); padding:0.3rem 0.8rem; border-radius:2rem; font-weight:700; text-transform: uppercase; letter-spacing: 0.5px;">Completed</span>`;
            }
            
            const hasReviewed = !!b.Review;
            const canReview = now >= startObj;
            
            let actionHtml = '';
            if (hasReviewed) {
                actionHtml = `<span style="color:var(--success); font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 0.25rem;"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Reviewed</span>`;
            } else if (canReview) {
                actionHtml = `<button class="btn btn-sm btn-review" data-id="${b.$id}" style="background:var(--accent); color:white; padding: 0.5rem 1.5rem; border-radius: 0.5rem; font-weight: 600; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)';" onmouseout="this.style.transform='translateY(0)';">Leave Review</button>`;
            }
            // If cannot review yet, show nothing to keep it clean.
            
            return `
                <div style="background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 1.2rem; padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; box-shadow: 0 4px 6px var(--shadow-color); transition: transform 0.2s, box-shadow 0.2s; ${isPast ? 'opacity: 0.75;' : ''}" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 24px var(--shadow-color)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px var(--shadow-color)';">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div>
                            <div style="margin-bottom: 0.8rem;">${statusBadge}</div>
                            <h4 style="font-size: 1.4rem; margin-bottom: 0.2rem; font-weight: 800;">${bLink}</h4>
                            <div style="font-size: 1rem; color: var(--text-secondary); font-weight: 500;">
                                ${roomName}
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
                        <div style="font-weight: 600; color: var(--text-secondary); font-size: 0.95rem;">
                            ${dateRange}
                        </div>
                        <div>
                            ${actionHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 2rem;">
                ${tableRows}
            </div>
        `;

        import('../components/Modals.js').then(m => {
            container.querySelectorAll('.btn-review').forEach(btn => {
                btn.addEventListener('click', () => {
                    const booking = this.bookings.find(bk => bk.$id === btn.getAttribute('data-id'));
                    m.openAddReviewModal(booking);
                });
            });
        });
    }

    renderFeaturedBuildings() {
        const grid = document.getElementById('featured-buildings');
        
        if (this.featuredBuildings.length === 0) {
            grid.innerHTML = `<div style="text-align:center; grid-column: 1 / -1;">No buildings currently available.</div>`;
            return;
        }

        grid.innerHTML = this.featuredBuildings.map(building => {
            let imgUrl = (building.Pictures && building.Pictures.length > 0) ? building.Pictures[0] : 'https://via.placeholder.com/400x300?text=No+Image';
            if (imgUrl.includes('appwrite.io') && !imgUrl.includes('project=')) {
                imgUrl += (imgUrl.includes('?') ? '&' : '?') + 'project=bedrock';
            }
            
            // Use the dynamically calculated room count
            const roomCount = building.roomCount || 0;

            return `
                <div class="card premium-card" style="padding: 0; cursor: pointer; display: flex; flex-direction: column; transition: all 0.3s ease; border: 1px solid var(--glass-border); border-radius: 1.2rem; overflow: hidden; background: var(--bg-secondary); box-shadow: 0 4px 6px var(--shadow-color);" data-id="${building.$id}" onclick="window.history.pushState(null, null, '/building/${building.$id}'); window.dispatchEvent(new Event('popstate'));" onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 20px 40px var(--shadow-color)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px var(--shadow-color)';">
                    <div style="position: relative;">
                        <div class="gallery-trigger" data-pictures="${JSON.stringify(building.Pictures || []).replace(/"/g, '&quot;')}" style="height: 200px; background: url('${imgUrl}') center/cover; position: relative;" title="Click to view all pictures">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%);"></div>
                        </div>
                        <div style="position: absolute; top: 1rem; right: 1rem; background: var(--glass-bg); backdrop-filter: blur(4px); padding: 0.4rem 1rem; border-radius: 2rem; border: 1px solid var(--glass-border); font-size: 0.8rem; font-weight: bold; color: var(--text-primary); letter-spacing: 1px; text-transform: uppercase;">
                            ${building.Type || 'Unknown'}
                        </div>
                    </div>
                    <div style="padding: 1.5rem; flex: 1; display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <h3 style="color: var(--text-primary); margin-bottom: 0.2rem; font-size: 1.3rem; font-weight: 800;">${building.Name || 'Unnamed Building'}</h3>
                            <div style="display: flex; align-items: center; gap: 0.25rem; background: var(--bg-color); padding: 0.2rem 0.6rem; border-radius: 1rem; border: 1px solid var(--glass-border);">
                                <svg fill="currentColor" viewBox="0 0 24 24" width="14" height="14" style="color: #fbbf24;"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>
                                <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${building.averageRating ? building.averageRating.toFixed(1) : 'New'}</span>
                            </div>
                        </div>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 1rem; display: flex; align-items: flex-start; gap: 0.5rem;">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="margin-top: 2px; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            <span>${building.Address || 'No Address Provided'}</span>
                        </p>
                        <div style="margin-top: auto; border-top: 1px solid var(--glass-border); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; margin-bottom: 0.2rem;">Available</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: ${building.availableRoomsCount > 0 ? 'var(--success)' : (building.roomCount > 0 ? 'var(--success)' : 'var(--danger)')};">${building.availableRoomsCount !== undefined ? building.availableRoomsCount : (building.roomCount || 0)} Rooms</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600; margin-bottom: 0.2rem;">${building.LeasingPeriod ? building.LeasingPeriod.charAt(0).toUpperCase() + building.LeasingPeriod.slice(1) + ' Price' : 'Price'}</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--accent);">${building.averageAvailablePrice ? `₦${Math.round(building.averageAvailablePrice).toLocaleString()}` : (building.Price ? `₦${Math.round(building.Price).toLocaleString()}` : 'View Details')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.gallery-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                import('../components/Modals.js').then(m => {
                    m.openLightboxGallery(JSON.parse(trigger.getAttribute('data-pictures')));
                });
            });
        });
    }
}
