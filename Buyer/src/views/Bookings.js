import { account, databases, DB_ID, COL_BOOKING, COL_BUILDING, COL_BUYER, COL_ROOM } from '../appwrite.js';
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
            
            // Hydrate nested relationships manually in case Appwrite returns just IDs
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
            const buildingsRes = await databases.listDocuments(DB_ID, COL_BUILDING);
            const allBuildings = buildingsRes.documents;
            
            // Load all rooms to accurately count them per building
            const roomsRes = await databases.listDocuments(DB_ID, COL_ROOM);
            const allRooms = roomsRes.documents;

            const shuffled = allBuildings.sort(() => 0.5 - Math.random());
            this.featuredBuildings = shuffled.slice(0, 5).map(b => {
                b.roomCount = allRooms.filter(r => r.Building && (r.Building.$id === b.$id || r.Building === b.$id)).length;
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
            const start = new Date(b.StartDate).toLocaleDateString();
            const end = new Date(b.EndDate).toLocaleDateString();
            
            const bLink = buildingId ? `<a href="/building/${buildingId}" data-link style="color: var(--text-primary); font-weight: 700; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-primary)'">${buildingName}</a>` : buildingName;
            const rLink = (buildingId && b.Room) ? `<a href="/building/${buildingId}#room-${b.Room.$id}" data-link style="color: var(--text-secondary); text-decoration: none; font-weight: 500; transition: color 0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-secondary)'">${roomName}</a>` : roomName;
            
            const startObj = new Date(b.StartDate);
            const endObj = new Date(b.EndDate);
            const now = new Date();
            
            let statusBadge = '';
            let isPast = false;
            if (now < startObj) {
                const diffTime = Math.abs(startObj - now);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                statusBadge = `<span style="font-size:0.75rem; background:rgba(37,99,235,0.1); color:var(--accent); padding:0.3rem 0.6rem; border-radius:1rem; font-weight:700; text-transform: uppercase; letter-spacing: 0.5px;">Upcoming (in ${diffDays} day${diffDays!==1?'s':''})</span>`;
            } else if (now >= startObj && now <= endObj) {
                const diffTime = Math.abs(endObj - now);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                statusBadge = `<span style="font-size:0.75rem; background:rgba(22,163,74,0.1); color:var(--success); padding:0.3rem 0.6rem; border-radius:1rem; font-weight:700; text-transform: uppercase; letter-spacing: 0.5px;">Active (${diffDays} day${diffDays!==1?'s':''} left)</span>`;
            } else {
                isPast = true;
                statusBadge = `<span style="font-size:0.75rem; background:var(--bg-color); border:1px solid var(--glass-border); color:var(--text-secondary); padding:0.3rem 0.6rem; border-radius:1rem; font-weight:700; text-transform: uppercase; letter-spacing: 0.5px;">Completed</span>`;
            }
            
            const hasReviewed = !!b.Review;
            const canReviewDate = startObj;
            const canReview = now >= canReviewDate;
            
            let actionHtml = '';
            if (hasReviewed) {
                actionHtml = `<button class="btn btn-sm" style="background:transparent; border: 1px solid var(--success); color:var(--success); padding: 0.5rem 1rem; border-radius: 0.5rem; opacity: 0.8; cursor: not-allowed; font-weight: 600;" disabled>Reviewed</button>`;
            } else if (!canReview) {
                actionHtml = `<button class="btn btn-sm" title="Review available on ${canReviewDate.toLocaleDateString()}" style="background:var(--bg-color); border: 1px solid var(--glass-border); color:var(--text-secondary); padding: 0.5rem 1rem; border-radius: 0.5rem; opacity: 0.7; cursor: not-allowed; font-weight: 600;" disabled>Review Later</button>`;
            } else {
                actionHtml = `<button class="btn btn-sm btn-review" data-id="${b.$id}" style="background:var(--accent); color:white; padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 600; box-shadow: 0 4px 6px rgba(37,99,235,0.2); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 12px rgba(37,99,235,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(37,99,235,0.2)';">Leave Review</button>`;
            }
            
            return `
                <div style="background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: 1rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 4px 6px var(--shadow-color); transition: transform 0.2s, box-shadow 0.2s; ${isPast ? 'opacity: 0.85;' : ''}" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 24px var(--shadow-color)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px var(--shadow-color)';">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                        <div>
                            <div style="margin-bottom: 0.5rem;">${statusBadge}</div>
                            <h4 style="font-size: 1.25rem; margin-bottom: 0.25rem; font-weight: 800;">${bLink}</h4>
                            <div style="font-size: 1rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                                ${rLink}
                            </div>
                        </div>
                        <div style="text-align: right; background: var(--bg-color); padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid var(--glass-border);">
                            <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">Stay Dates</div>
                            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${start} &rarr; ${end}</div>
                        </div>
                    </div>
                    <div style="border-top: 1px solid var(--glass-border); padding-top: 1rem; display: flex; justify-content: flex-end;">
                        ${actionHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
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
                <div class="card premium-card" style="padding: 0; cursor: pointer; display: flex; flex-direction: column; transition: all 0.3s ease; border: 1px solid var(--glass-border); border-radius: 1rem; overflow: hidden; background: var(--bg-secondary); box-shadow: 0 4px 6px var(--shadow-color);" data-id="${building.$id}" onclick="window.history.pushState(null, null, '/building/${building.$id}'); window.dispatchEvent(new Event('popstate'));" onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 20px 40px var(--shadow-color)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px var(--shadow-color)';">
                    <div style="position: relative;">
                        <div class="gallery-trigger" data-pictures="${JSON.stringify(building.Pictures || []).replace(/"/g, '&quot;')}" style="height: 180px; background: url('${imgUrl}') center/cover; position: relative;" title="Click to view all pictures">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%);"></div>
                        </div>
                        <div style="position: absolute; top: 1rem; right: 1rem; background: var(--glass-bg); backdrop-filter: blur(4px); padding: 0.4rem 1rem; border-radius: 2rem; border: 1px solid var(--glass-border); font-size: 0.8rem; font-weight: bold; color: var(--text-primary); letter-spacing: 1px; text-transform: uppercase;">
                            ${building.Type || 'Unknown'}
                        </div>
                    </div>
                    <div style="padding: 1.25rem; flex: 1; display: flex; flex-direction: column;">
                        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.2rem; font-weight: 700;">${building.Name || 'Unnamed Building'}</h3>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); flex: 1; display: flex; align-items: flex-start; gap: 0.5rem;">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14" style="margin-top: 2px; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            <span>${building.Address || 'No Address Provided'}</span>
                        </p>
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.85rem; font-weight: bold; color: var(--text-primary);">Rooms: <span style="color: var(--success);">${roomCount}</span></span>
                            <span style="color: var(--accent); font-weight: 600; font-size: 0.85rem;">View Details &rarr;</span>
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
