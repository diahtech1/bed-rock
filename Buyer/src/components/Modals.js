import flatpickr from "flatpickr";
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { account, databases, DB_ID, COL_BOOKING, COL_REVIEW, COL_CARDINFO, COL_BUYER, ID } from '../appwrite.js';
import { navigateTo } from '../main.js';

const modalContainer = document.getElementById('modal-container');

function createModalHTML(title, contentHTML) {
    return `
        <div class="modal-overlay" id="dynamic-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 style="color: var(--accent); font-size: 1.5rem;">${title}</h2>
                    <button class="modal-close" id="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    ${contentHTML}
                </div>
            </div>
        </div>
    `;
}

function attachCloseEvent() {
    const overlay = document.getElementById('dynamic-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    
    const closeModal = () => {
        overlay.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

export function openFilterModal(catalogueInstance, activeFilters = {}) {
    const html = `
        <form id="filter-form">
            <label>Min Room Price</label>
            <input type="number" id="filter-min-price" value="${activeFilters.minPrice || ''}" />
            
            <label>Max Room Price</label>
            <input type="number" id="filter-max-price" value="${activeFilters.maxPrice || ''}" />

            <div style="display:flex; gap:1rem;">
                <div style="flex:1;">
                    <label>Min Beds</label>
                    <input type="number" id="filter-beds" value="${activeFilters.beds || ''}" />
                </div>
                <div style="flex:1;">
                    <label>Min Baths</label>
                    <input type="number" id="filter-baths" value="${activeFilters.baths || ''}" />
                </div>
                <div style="flex:1;">
                    <label>Min Occupants</label>
                    <input type="number" id="filter-occupants" value="${activeFilters.occupants || ''}" />
                </div>
            </div>
            
            <button type="submit" class="btn" style="width:100%; margin-top:1rem;">Apply Filters</button>
        </form>
    `;
    modalContainer.innerHTML = createModalHTML("Advanced Room Filters", html);
    attachCloseEvent();

    document.getElementById('filter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const filters = {
            minPrice: parseFloat(document.getElementById('filter-min-price').value) || null,
            maxPrice: parseFloat(document.getElementById('filter-max-price').value) || null,
            beds: parseInt(document.getElementById('filter-beds').value) || null,
            baths: parseInt(document.getElementById('filter-baths').value) || null,
            occupants: parseInt(document.getElementById('filter-occupants').value) || null,
        };
        catalogueInstance.applyFilter(filters);
        document.getElementById('dynamic-modal').remove();
    });
}

export function openSortModal(catalogueInstance) {
    const html = `
        <div style="display:flex; flex-direction:column; gap: 1rem;">
            <button class="btn sort-btn" data-sort="availability" style="background:var(--bg-secondary); border:1px solid var(--glass-border); color:var(--text-primary);">Availability (Most Rooms)</button>
            <button class="btn sort-btn" data-sort="price" style="background:var(--bg-secondary); border:1px solid var(--glass-border); color:var(--text-primary);">Price (Lowest to Highest)</button>
            <button class="btn sort-btn" data-sort="alphabetical" style="background:var(--bg-secondary); border:1px solid var(--glass-border); color:var(--text-primary);">Alphabetical (A-Z)</button>
            <button class="btn sort-btn" data-sort="rating" style="background:var(--bg-secondary); border:1px solid var(--glass-border); color:var(--text-primary);">Average Room Rating</button>
        </div>
    `;
    modalContainer.innerHTML = createModalHTML("Sort Buildings", html);
    attachCloseEvent();

    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            catalogueInstance.applySort(btn.getAttribute('data-sort'));
            document.getElementById('dynamic-modal').remove();
        });
    });
}

export function openBookingsModal(room) {
    const html = `
        <p style="margin-bottom: 1rem;">Calendar for <strong>${room.RoomName}</strong></p>
        <div id="calendar-container"></div>
    `;
    modalContainer.innerHTML = createModalHTML("Room Bookings", html);
    attachCloseEvent();

    // Prepare booked dates
    const events = (room.Bookings || []).map(b => {
        return {
            title: 'Booked',
            start: b.StartDate,
            end: b.EndDate,
            color: '#ef4444',
            allDay: true
        };
    });

    const calendarEl = document.getElementById('calendar-container');
    const calendar = new Calendar(calendarEl, {
        plugins: [dayGridPlugin],
        initialView: 'dayGridMonth',
        events: events,
        eventDisplay: 'block',
        height: 'auto'
    });

    setTimeout(() => {
        calendar.render();
    }, 100);
}

export function openReviewsModal(room) {
    let reviewsHtml = '';
    const bookingsWithReviews = (room.Bookings || []).filter(b => b.Review);
    
    if (bookingsWithReviews.length === 0) {
        reviewsHtml = `<p>No Reviews Yet</p>`;
    } else {
        reviewsHtml = bookingsWithReviews.map(b => {
            const date = new Date(b.Review.$createdAt || Date.now()).toLocaleDateString();
            const buyerName = (b.Buyer && b.Buyer.Name) ? b.Buyer.Name : 'Anonymous';
            return `
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid var(--glass-border);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <strong>${buyerName}</strong>
                        <span style="color:var(--accent);">★ ${b.Review.Rating}</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:0.5rem;">${b.Review.Comment || ''}</p>
                    <small style="color:var(--text-secondary); font-size:0.8rem;">${date}</small>
                </div>
            `;
        }).join('');
    }

    modalContainer.innerHTML = createModalHTML(`Reviews - ${room.RoomName}`, reviewsHtml);
    attachCloseEvent();
}

export async function openBookModal(room, building) {
    let buyerId;
    let buyerDoc;
    try {
        const user = await account.get();
        const { Query } = await import('appwrite');
        const buyers = await databases.listDocuments(DB_ID, COL_BUYER, [Query.equal('Email', user.email)]);
        if (buyers.documents.length > 0) {
            buyerDoc = buyers.documents[0];
            buyerId = buyerDoc.$id;
        } else {
            throw new Error("No buyer profile linked");
        }
    } catch (e) {
        alert("Please login to book a room.");
        navigateTo('/login');
        return;
    }

    let userCards = [];
    try {
        const { Query } = await import('appwrite');
        const cardsRes = await databases.listDocuments(DB_ID, COL_CARDINFO, [
            Query.equal('Buyer', buyerId)
        ]);
        userCards = cardsRes.documents;
    } catch (e) {
        console.error("Failed to fetch cards directly by Buyer ID", e);
    }

    const durationUnit = building.LeasingPeriod === 'daily' ? 'Days' : (building.LeasingPeriod === 'monthly' ? 'Months' : 'Years');

    const isHall = room === null;
    const targetEntity = isHall ? building : room;
    const entityName = isHall ? building.Name : room.RoomName;
    const price = isHall ? (building.Price || 0) : (room.RoomPrice || 0);
    const bookings = isHall ? (building.BuildingBookings || []) : (room.Bookings || []);

    const html = `
        <div id="book-modal-step1">
            <h3 style="margin-bottom: 1rem;">Payment Information</h3>
            <select id="card-select" style="margin-bottom: 1rem;">
                ${userCards.map((c, i) => `<option value="${c.$id}">Card ending in ${c.CardNbr ? c.CardNbr.slice(-4) : '...'}</option>`).join('')}
                <option value="new" ${userCards.length === 0 ? 'selected' : ''}>Add New Card...</option>
            </select>

            <div id="new-card-form" style="display: ${userCards.length === 0 ? 'block' : 'none'}; background: var(--bg-secondary); padding: 1rem; border: 1px dashed var(--glass-border); border-radius: 0.5rem; margin-bottom: 1.5rem;">
                <label>Card Number</label>
                <input type="text" id="new-card-nbr" placeholder="1234 5678 9101 1121" />
                <div style="display:flex; gap: 1rem;">
                    <div style="flex:1;">
                        <label>Expiry Date</label>
                        <input type="date" id="new-card-exp" />
                    </div>
                    <div style="flex:1;">
                        <label>CVV</label>
                        <input type="password" id="new-card-cvv" placeholder="123" maxlength="3" />
                    </div>
                </div>
            </div>

            <h3 style="margin-bottom: 1rem;">Booking Duration</h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">Leasing Period: <strong>${building.LeasingPeriod}</strong></p>
            
            <label>Start Date</label>
            <input type="text" id="booking-date" required placeholder="Select start date..." />

            <label>Duration (${durationUnit})</label>
            <input type="number" id="booking-duration" required min="1" value="1" placeholder="Number of ${durationUnit.toLowerCase()}" />

            <div id="calculation-preview" style="display:none; background: rgba(37, 99, 235, 0.1); padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; border: 1px solid var(--accent);">
                <p><strong>End Date:</strong> <span id="preview-end-date"></span></p>
                <p><strong>Total Cost:</strong> ₦<span id="preview-total-cost"></span></p>
            </div>
            
            <button id="book-confirm-btn" class="btn" style="width: 100%; margin-top: 1rem;" disabled>Book ${isHall ? 'Hall' : 'Room'}</button>
        </div>
        <div id="book-modal-step2" style="display:none; text-align:center;">
            <p id="prompt-msg" style="margin-bottom: 2rem; font-size: 1.1rem;"></p>
            <div style="display:flex; gap: 1rem; justify-content:center;">
                <button id="prompt-yes" class="btn">Confirm & Book</button>
                <button id="prompt-no" class="btn" style="background:var(--bg-secondary); border: 1px solid var(--glass-border); color: var(--text-primary);">Cancel</button>
            </div>
        </div>
    `;

    modalContainer.innerHTML = createModalHTML(`Book ${building.Name}${!isHall ? ` - ${entityName}` : ''}`, html);
    attachCloseEvent();

    document.getElementById('card-select').addEventListener('change', (e) => {
        if (e.target.value === 'new') {
            document.getElementById('new-card-form').style.display = 'block';
        } else {
            document.getElementById('new-card-form').style.display = 'none';
        }
    });

    const disableDates = bookings.map(b => ({
        from: new Date(b.StartDate),
        to: new Date(b.EndDate)
    }));

    let selectedStartDate = null;
    let computedEndDate = null;
    let finalCost = 0;

    const calculateBooking = () => {
        if (!selectedStartDate) return;
        
        const duration = parseInt(document.getElementById('booking-duration').value) || 1;
        computedEndDate = new Date(selectedStartDate);
        
        if (building.LeasingPeriod === 'daily') {
            computedEndDate.setDate(computedEndDate.getDate() + duration);
        } else if (building.LeasingPeriod === 'monthly') {
            computedEndDate.setMonth(computedEndDate.getMonth() + duration);
        } else if (building.LeasingPeriod === 'yearly') {
            computedEndDate.setFullYear(computedEndDate.getFullYear() + duration);
        }

        finalCost = duration * price;

        // Check if the period overlaps with any existing booking
        const overlap = disableDates.some(d => {
            return (selectedStartDate < d.to && computedEndDate > d.from);
        });

        const btn = document.getElementById('book-confirm-btn');
        document.getElementById('calculation-preview').style.display = 'block';
        document.getElementById('preview-end-date').textContent = computedEndDate.toLocaleDateString();
        document.getElementById('preview-total-cost').textContent = finalCost.toLocaleString();

        if (overlap) {
            document.getElementById('preview-end-date').innerHTML += ` <span style="color:var(--danger);">(Overlaps with existing booking)</span>`;
            btn.disabled = true;
        } else {
            btn.disabled = false;
        }
    };

    flatpickr("#booking-date", {
        disable: disableDates,
        minDate: "today",
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
                selectedStartDate = selectedDates[0];
                calculateBooking();
            }
        }
    });

    document.getElementById('booking-duration').addEventListener('input', calculateBooking);

    document.getElementById('book-confirm-btn').addEventListener('click', () => {
        const cardVal = document.getElementById('card-select').value;
        if (cardVal === 'new') {
            const nbr = document.getElementById('new-card-nbr').value;
            const exp = document.getElementById('new-card-exp').value;
            const cvv = document.getElementById('new-card-cvv').value;
            if (!nbr || !exp || !cvv) {
                alert("Please fill out all new card details.");
                return;
            }
        }

        document.getElementById('book-modal-step1').style.display = 'none';
        document.getElementById('book-modal-step2').style.display = 'block';
        document.getElementById('prompt-msg').innerHTML = `Are you sure you want to book <strong>${entityName}</strong> until <strong>${computedEndDate.toLocaleDateString()}</strong> for <strong>₦${finalCost.toLocaleString()}</strong>?`;
    });

    document.getElementById('prompt-no').addEventListener('click', () => {
        document.getElementById('book-modal-step2').style.display = 'none';
        document.getElementById('book-modal-step1').style.display = 'block';
    });

    document.getElementById('prompt-yes').addEventListener('click', async () => {
        const btn = document.getElementById('prompt-yes');
        btn.disabled = true;
        btn.textContent = "Processing...";

        try {
            const cardVal = document.getElementById('card-select').value;
            let finalCardId = cardVal;

            if (cardVal === 'new') {
                const newCardDoc = await databases.createDocument(DB_ID, COL_CARDINFO, ID.unique(), {
                    CardNbr: document.getElementById('new-card-nbr').value,
                    ExpDate: new Date(document.getElementById('new-card-exp').value).toISOString(),
                    CVV: document.getElementById('new-card-cvv').value,
                    Buyer: buyerId
                });
                finalCardId = newCardDoc.$id;

                let currentCards = [];
                if (buyerDoc.CardInfo && Array.isArray(buyerDoc.CardInfo)) {
                    currentCards = buyerDoc.CardInfo.map(c => typeof c === 'object' ? c.$id : c);
                } else if (buyerDoc.CardInfo && typeof buyerDoc.CardInfo === 'object') {
                    currentCards = [buyerDoc.CardInfo.$id];
                } else if (buyerDoc.CardInfo && typeof buyerDoc.CardInfo === 'string') {
                    currentCards = [buyerDoc.CardInfo];
                }
                currentCards.push(finalCardId);
                
                await databases.updateDocument(DB_ID, COL_BUYER, buyerId, {
                    CardInfo: currentCards
                });
            }

            // Create Booking
            const bookingData = {
                StartDate: selectedStartDate.toISOString(),
                EndDate: computedEndDate.toISOString(),
                Buyer: buyerId
            };
            if (isHall) {
                bookingData.Building = building.$id;
            } else {
                bookingData.Room = room.$id;
            }
            const newBooking = await databases.createDocument(DB_ID, COL_BOOKING, ID.unique(), bookingData);
            
            bookings.push(newBooking);
            
            alert("Booking successful!");
            document.getElementById('dynamic-modal').remove();
            
            // Short delay to ensure Appwrite indexing catches the new document before listing
            setTimeout(() => {
                navigateTo('/bookings');
            }, 500);
        } catch (err) {
            console.error(err);
            alert("Booking failed. Please try again.");
            btn.disabled = false;
            btn.textContent = "Confirm & Book";
        }
    });
}

export function openAddReviewModal(booking) {
    const html = `
        <form id="review-form">
            <label>Rating (0 - 5)</label>
            <input type="range" id="review-rating" min="0" max="5" step="0.5" value="${booking.Review ? booking.Review.Rating : 3}" />
            <span id="rating-val" style="display:block; text-align:center; margin-bottom: 1rem; color:var(--accent); font-weight:bold;">${booking.Review ? booking.Review.Rating : 3}</span>
            
            <label>Comment</label>
            <textarea id="review-comment" rows="4">${booking.Review ? (booking.Review.Comment || '') : ''}</textarea>
            
            <button type="submit" class="btn" style="width:100%;">Submit Review</button>
        </form>
    `;
    modalContainer.innerHTML = createModalHTML("Write Review", html);
    attachCloseEvent();

    document.getElementById('review-rating').addEventListener('input', (e) => {
        document.getElementById('rating-val').textContent = e.target.value;
    });

    document.getElementById('review-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Check date logic
        const now = new Date();
        const start = new Date(booking.StartDate);
        if (now < start) {
            alert("Review Rejected: Booking period has not started.");
            return;
        }

        const rating = parseFloat(document.getElementById('review-rating').value);
        const comment = document.getElementById('review-comment').value;

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = "Submitting...";

        try {
            if (booking.Review) {
                // Update existing
                await databases.updateDocument(DB_ID, COL_REVIEW, booking.Review.$id, {
                    Rating: rating,
                    Comment: comment
                });
            } else {
                // Create new
                const revDoc = await databases.createDocument(DB_ID, COL_REVIEW, ID.unique(), {
                    Rating: rating,
                    Comment: comment,
                    Booking: booking.$id
                });
                // Link back to booking - Appwrite relationship might handle this if it's two-way, but let's be explicit
                await databases.updateDocument(DB_ID, COL_BOOKING, booking.$id, {
                    Review: revDoc.$id
                });
            }
            alert("Review saved!");
            document.getElementById('dynamic-modal').remove();
            window.location.reload();
        } catch(err) {
            console.error(err);
            alert("Failed to save review.");
            btn.disabled = false;
            btn.textContent = "Submit Review";
        }
    });
}

export function openLightboxGallery(pictures) {
    if (!pictures || pictures.length === 0) {
        pictures = ['https://via.placeholder.com/800x600?text=No+Image'];
    }
    let currentIndex = 0;

    function getImageUrl(url) {
        if (url.includes('appwrite.io') && !url.includes('project=')) {
            return url + (url.includes('?') ? '&' : '?') + 'project=bedrock';
        }
        return url;
    }

    const html = `
        <div class="modal-overlay" id="lightbox-modal" style="background: rgba(0,0,0,0.9); z-index: 10000; display: flex; flex-direction: column; justify-content: center; align-items: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%;">
            <button id="lightbox-close" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: white; font-size: 2rem; cursor: pointer; z-index: 10001;">&times;</button>
            
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 80vh;">
                <button id="lightbox-prev" style="position: absolute; left: 1rem; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 50px; height: 50px; font-size: 1.5rem; cursor: pointer; z-index: 10001;">&larr;</button>
                
                <img id="lightbox-img" src="${getImageUrl(pictures[currentIndex])}" style="max-height: 100%; max-width: 90%; object-fit: contain; border-radius: 8px;">
                
                <button id="lightbox-next" style="position: absolute; right: 1rem; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 50px; height: 50px; font-size: 1.5rem; cursor: pointer; z-index: 10001;">&rarr;</button>
            </div>
            <div id="lightbox-counter" style="color: white; margin-top: 1rem; font-size: 1.2rem;">
                ${currentIndex + 1} / ${pictures.length}
            </div>
        </div>
    `;

    document.getElementById('modal-container').insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('lightbox-modal');
    const imgEl = document.getElementById('lightbox-img');
    const counterEl = document.getElementById('lightbox-counter');

    function updateImage() {
        imgEl.src = getImageUrl(pictures[currentIndex]);
        counterEl.textContent = `${currentIndex + 1} / ${pictures.length}`;
    }

    document.getElementById('lightbox-close').addEventListener('click', () => {
        modal.remove();
    });

    document.getElementById('lightbox-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        if (pictures.length <= 1) return;
        currentIndex = (currentIndex - 1 + pictures.length) % pictures.length;
        updateImage();
    });

    document.getElementById('lightbox-next').addEventListener('click', (e) => {
        e.stopPropagation();
        if (pictures.length <= 1) return;
        currentIndex = (currentIndex + 1) % pictures.length;
        updateImage();
    });

    let touchstartX = 0;
    let touchendX = 0;
    modal.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    });
    modal.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        if (touchstartX - touchendX > 50) { // Swipe left (next)
            if (pictures.length <= 1) return;
            currentIndex = (currentIndex + 1) % pictures.length;
            updateImage();
        } else if (touchendX - touchstartX > 50) { // Swipe right (prev)
            if (pictures.length <= 1) return;
            currentIndex = (currentIndex - 1 + pictures.length) % pictures.length;
            updateImage();
        }
    });
}

export function openFutureUpdatesModal() {
    const html = `
        <div style="text-align: left;">
            <p style="margin-bottom: 1rem; color: var(--text-secondary);">We are constantly working to improve Bedrock. Here is a taste of what is coming soon to the Platform:</p>
            <ul style="list-style-type: disc; margin-left: 1.5rem; color: var(--text-primary); line-height: 1.8;">
                <li><strong>Proximity Sorting:</strong> Find buildings sorted by their distance to your campus or workplace.</li>
                <li><strong>AI Chat bot:</strong> A smart assistant to help you navigate, find the perfect room, and answer your questions instantly.</li>
                <li><strong>Refund Period:</strong> Clear and automated refund processes for eligible bookings.</li>
            </ul>
        </div>
    `;
    modalContainer.innerHTML = createModalHTML("Future Updates", html);
    attachCloseEvent();
}
