import { databases, DB_ID, COL_BUILDING, Query, syncSavedItem } from '../appwrite.js';

export default class Home {
    constructor() {
        document.title = "Bedrock | Home";
        this.buildings = [];
        this.savedBuildingIds = [];
    }

    async render() {
        return `
            <div style="text-align: center; padding: 4rem 1rem; background: linear-gradient(135deg, rgba(37,99,235,0.05) 0%, rgba(37,99,235,0) 100%); border-radius: 1rem; margin-bottom: 3rem;">
                <h1 style="font-size: 3.5rem; margin-bottom: 1rem; color: var(--accent); font-weight: 800; letter-spacing: -1px;">Welcome to Bedrock</h1>
                <p style="font-size: 1.25rem; color: var(--text-secondary); max-width: 650px; margin: 0 auto 2.5rem; line-height: 1.6;">
                    The centralized accommodation procurement platform for Redemption City. 
                    Browse live unit listings and book instantly with no waiting period.
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <a href="/login" class="btn" style="font-size: 1.1rem; padding: 0.8rem 2rem;" data-link>Get Started</a>
                    <a href="/catalogue" class="btn" style="background: transparent; border: 1px solid var(--accent); color: var(--accent); font-size: 1.1rem; padding: 0.8rem 2rem;" data-link>Browse Catalog</a>
                </div>
            </div>

            <h2 style="font-size: 2rem; margin-bottom: 2rem; color: var(--text-primary); text-align: center;">Featured Accommodations</h2>
            <div id="featured-buildings" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3rem;">
                <div style="text-align: center; grid-column: 1 / -1; padding: 2rem;">Loading featured buildings...</div>
            </div>
            <div style="text-align: center; margin-bottom: 4rem;">
                <a href="/catalogue" class="btn" style="padding: 0.75rem 3rem;" data-link>View All Buildings</a>
            </div>
        `;
    }

    async mounted() {
        try {
            const response = await databases.listDocuments(DB_ID, COL_BUILDING, [Query.limit(100)]);
            let allBuildings = response.documents;
            
            // Randomly select up to 6 buildings
            const shuffled = allBuildings.sort(() => 0.5 - Math.random());
            this.buildings = shuffled.slice(0, 6);

            // Load saved state
            try {
                const bSaved = localStorage.getItem('bedrock_saved_buildings');
                if (bSaved) this.savedBuildingIds = JSON.parse(bSaved);
            } catch(e) {}

            this.renderFeatured();
        } catch (err) {
            console.error("Failed to load featured buildings", err);
            document.getElementById('featured-buildings').innerHTML = `<div style="color:var(--danger); grid-column: 1 / -1; text-align: center;">Failed to load featured buildings.</div>`;
        }
    }

    renderFeatured() {
        const grid = document.getElementById('featured-buildings');
        if (this.buildings.length === 0) {
            grid.innerHTML = `<div style="text-align:center; grid-column: 1 / -1;">No buildings currently available.</div>`;
            return;
        }

        grid.innerHTML = this.buildings.map(building => {
            let imgUrl = (building.Pictures && building.Pictures.length > 0) ? building.Pictures[0] : 'https://via.placeholder.com/400x300?text=No+Image';
            if (imgUrl.includes('appwrite.io') && !imgUrl.includes('project=')) {
                imgUrl += (imgUrl.includes('?') ? '&' : '?') + 'project=bedrock';
            }

            const isSaved = this.savedBuildingIds.includes(building.$id);
            const heartIcon = isSaved ? 
                `<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
                `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24" style="color: white;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;

            return `
                <div class="card premium-card" style="padding: 0; cursor: pointer; display: flex; flex-direction: column; transition: all 0.3s ease; border: 1px solid var(--glass-border); border-radius: 1rem; overflow: hidden; background: var(--bg-secondary); box-shadow: 0 4px 6px var(--shadow-color);" data-id="${building.$id}" onclick="window.history.pushState(null, null, '/building/${building.$id}'); window.dispatchEvent(new Event('popstate'));" onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 20px 40px var(--shadow-color)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px var(--shadow-color)';">
                    <div style="position: relative;">
                        <div class="gallery-trigger" data-pictures="${JSON.stringify(building.Pictures || []).replace(/"/g, '&quot;')}" style="height: 220px; background: url('${imgUrl}') center/cover; position: relative;" title="Click to view all pictures">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%);"></div>
                        </div>
                        <button class="like-btn" data-id="${building.$id}" data-saved="${isSaved}" style="position: absolute; top: 1rem; left: 1rem; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s;" onclick="event.stopPropagation();">
                            ${heartIcon}
                        </button>
                        <div style="position: absolute; top: 1rem; right: 1rem; background: var(--glass-bg); backdrop-filter: blur(4px); padding: 0.4rem 1rem; border-radius: 2rem; border: 1px solid var(--glass-border); font-size: 0.8rem; font-weight: bold; color: var(--text-primary); letter-spacing: 1px; text-transform: uppercase;">
                            ${building.Type || 'Unknown'}
                        </div>
                    </div>
                    <div style="padding: 1.5rem; flex: 1; display: flex; flex-direction: column;">
                        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem; font-weight: 700;">${building.Name || 'Unnamed Building'}</h3>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); flex: 1; display: flex; align-items: flex-start; gap: 0.5rem;">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="margin-top: 2px; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            <span>${building.Address || 'No Address Provided'}</span>
                        </p>
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--accent); font-weight: 600; font-size: 0.9rem;">View Details &rarr;</span>
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

        grid.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const buildingId = btn.getAttribute('data-id');
                    const isSaved = btn.getAttribute('data-saved') === 'true';
                    
                    // Update State
                    const newSavedState = !isSaved;
                    btn.setAttribute('data-saved', newSavedState.toString());
                    btn.innerHTML = newSavedState ? 
                        `<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24" style="color: var(--danger);"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>` : 
                        `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24" style="color: white;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
                    
                    // Update localStorage
                    let savedArray = [];
                    try {
                        const saved = localStorage.getItem('bedrock_saved_buildings');
                        if (saved) savedArray = JSON.parse(saved);
                    } catch(e) {}

                    if (newSavedState) {
                        if (!savedArray.includes(buildingId)) savedArray.push(buildingId);
                        this.savedBuildingIds.push(buildingId);
                        syncSavedItem('building', buildingId, 'add');
                    } else {
                        savedArray = savedArray.filter(id => id !== buildingId);
                        this.savedBuildingIds = this.savedBuildingIds.filter(id => id !== buildingId);
                        syncSavedItem('building', buildingId, 'remove');
                    }
                    localStorage.setItem('bedrock_saved_buildings', JSON.stringify(savedArray));

                } catch (err) {
                    console.error("Like toggle failed", err);
                }
            });
        });
    }
}
