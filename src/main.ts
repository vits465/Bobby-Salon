/* eslint-disable @typescript-eslint/no-explicit-any */
import './index.css';

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
    window.location.replace(window.location.origin + '/#admin' + window.location.search);
    return;
  }

  const escapeHtml = (str: string): string => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const getIndiaDateString = (): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  };

  const getTomorrowDateString = (): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatter.format(d);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-content">${escapeHtml(message)}</div>
      <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger transition
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    const closeToast = () => {
      toast.classList.remove('toast-show');
      const onTransitionEnd = () => {
        toast.remove();
        toast.removeEventListener('transitionend', onTransitionEnd);
      };
      toast.addEventListener('transitionend', onTransitionEnd);
    };

    toast.querySelector('.toast-close')?.addEventListener('click', closeToast);

    // Auto-remove after 4 seconds
    setTimeout(closeToast, 4000);
  };



  // Magnetic Button Logic
  const magneticElements = document.querySelectorAll('.magnetic');
  magneticElements.forEach(el => {
    el.addEventListener('mousemove', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const rect = (el as HTMLElement).getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left - rect.width / 2;
      const y = mouseEvent.clientY - rect.top - rect.height / 2;
      
      (el as HTMLElement).style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
    });
    
    el.addEventListener('mouseleave', () => {
      (el as HTMLElement).style.transform = 'translate(0px, 0px)';
    });
  });

  // Full-Stack Booking Integration & Time Slots
  const bookingForm = document.getElementById('booking-form') as HTMLFormElement;
  const timeSlotGrid = document.getElementById('time-slot-grid') as HTMLDivElement;
  const timeInput = document.getElementById('b-time') as HTMLInputElement;
  const dateInput = document.getElementById('b-date') as HTMLInputElement;
  const queueInput = document.getElementById('b-queue') as HTMLInputElement;
  const submitBtn = document.getElementById('booking-submit-btn') as HTMLButtonElement;

  const genderInput = document.getElementById('b-gender') as HTMLSelectElement;
  const serviceInput = document.getElementById('b-service') as HTMLSelectElement;
  const barberInput = document.getElementById('b-barber') as HTMLSelectElement;

  let servicesList: any[] = [];

  const updateBookingServiceOptions = () => {
    if (!genderInput || !serviceInput || !barberInput) return;
    const gender = genderInput.value;
    if (!gender) return;

    serviceInput.innerHTML = '<option value="" disabled selected>Select Service</option>';
    serviceInput.disabled = false;

    // Filter services from database by gender
    const filtered = servicesList.filter(s => s.gender === gender);
    filtered.forEach(s => {
      const option = document.createElement('option');
      option.value = s.name;
      option.textContent = s.name;
      serviceInput.appendChild(option);
    });

    if (gender === 'Male') {
      barberInput.innerHTML = `
        <option value="" disabled selected>Preferred Barber</option>
        <option value="Any Available">Any Available</option>
        <option value="Bobby">Bobby</option>
        <option value="Sumit">Sumit</option>
        <option value="shetty Bhai">shetty Bhai</option>
      `;
    } else if (gender === 'Female') {
      barberInput.innerHTML = `
        <option value="Sumit" selected>Sumit (Specialist)</option>
      `;
    }
  };

  // Attach change listener
  genderInput?.addEventListener('change', () => {
    updateBookingServiceOptions();
    if (typeof (window as any).renderSlots === 'function') {
      (window as any).renderSlots();
    }
  });

  const renderServicesCatalog = () => {
    const grid = document.getElementById('catalog-services-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const activeTab = document.querySelector('.filter-tab.active')?.getAttribute('data-filter') || 'all';
    const searchQuery = (document.getElementById('catalog-search') as HTMLInputElement)?.value.toLowerCase() || '';

    const filtered = servicesList.filter(s => {
      const matchesTab = activeTab === 'all' || s.gender === activeTab;
      const matchesSearch = s.name.toLowerCase().includes(searchQuery);
      return matchesTab && matchesSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-secondary);font-family:var(--font-mono);padding:2rem 0;">No services found matching your criteria.</p>`;
      return;
    }

    filtered.forEach(s => {
      const card = document.createElement('div');
      card.className = 'service-card hover-expand hover-target';
      
      const genderClass = s.gender === 'Female' ? 'female' : 'male';
      card.innerHTML = `
        <div class="service-card-top">
          <span class="service-gender-tag ${genderClass}">${escapeHtml(s.gender)}</span>
          <h3>${escapeHtml(s.name)}</h3>
        </div>
        <div class="service-card-bottom">
          <span class="service-duration">${escapeHtml(s.duration)} MIN</span>
        </div>
      `;

      // Click to book shortcut
      card.addEventListener('click', () => {
        const bookingSection = document.getElementById('booking');
        if (bookingSection) {
          bookingSection.scrollIntoView({ behavior: 'smooth' });
          if (genderInput && serviceInput) {
            genderInput.value = s.gender;
            updateBookingServiceOptions();
            serviceInput.value = s.name;
            if (typeof (window as any).renderSlots === 'function') {
              (window as any).renderSlots();
            }
          }
        }
      });

      grid.appendChild(card);
    });


  };

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services');
      servicesList = await res.json();
      renderServicesCatalog();
      updateBookingServiceOptions();
      // If admin is active, render services table
      if (window.location.hash.startsWith('#admin')) {
        fetchAdminServicesData();
      }
    } catch (err) {
      console.error("Failed to load services:", err);
    }
  };

  // Set today's date as default and restrict past dates
  if (dateInput) {
    const today = getIndiaDateString();
    dateInput.value = today;
    dateInput.min = today;
  }

  let currentSlotsData: any[] = [];

  const renderSlots = () => {
    if (!timeSlotGrid) return;
    timeSlotGrid.innerHTML = '';
    const selectedService = serviceInput ? serviceInput.value : '';
    const gender = genderInput ? genderInput.value : '';

    // Determine the slot type required by the selected service
    let requiredSlotType: string | null = null;
    if (selectedService) {
      const s = selectedService.toLowerCase();
      const isBeardOnly = (s.includes('beard') || s.includes('shave')) && !s.includes('haircut') && !s.includes('hair cut');
      requiredSlotType = isBeardOnly ? 'beard_only' : 'haircut_beard';
    }

    if (currentSlotsData.length === 0) {
      timeSlotGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); font-family: var(--font-mono); padding: 2rem;">No available slots for this date.</p>`;
      return;
    }

    currentSlotsData.forEach((slot: any, index: number) => {
      // ── Break Slot ────────────────────────────────────────────────
      if (slot.isBreak) {
        const breakEl = document.createElement('div');
        breakEl.className = 'slot-break-separator';
        breakEl.style.cssText = `
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          margin: 0.5rem 0;
          background: linear-gradient(90deg, transparent, rgba(180,120,0,0.12), transparent);
          border-radius: 8px;
          border: 1px dashed rgba(180,120,0,0.3);
        `;
        breakEl.innerHTML = `
          <span style="font-family: var(--font-mono); font-size: 0.78rem; letter-spacing: 0.12em; color: rgba(180,120,0,0.85); font-weight: 600;">${slot.label || '⏸ BREAK'}</span>
          <div style="flex: 1; height: 1px; background: rgba(180,120,0,0.2);"></div>
          <span style="font-family: var(--font-mono); font-size: 0.7rem; color: rgba(180,120,0,0.6);">CLOSED</span>
        `;
        timeSlotGrid.appendChild(breakEl);
        return;
      }

      // ── Determine visibility based on selected service ─────────
      // Beard-only customers only see beard_only slots
      // Haircut+Beard customers only see haircut_beard slots
      // No service selected → show all slots
      let isHidden = false;
      if (requiredSlotType === 'beard_only' && slot.type !== 'beard_only') {
        isHidden = true;
      } else if (requiredSlotType === 'haircut_beard' && slot.type !== 'haircut_beard') {
        isHidden = true;
      }

      // Also check female availability (Sumit must be free)
      let isTaken = slot.taken;
      if (gender === 'Female' && !slot.sumitAvailable) {
        isTaken = true;
      }

      // Build the slot card
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `slot-${slot.time.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const isBeardSlot = slot.type === 'beard_only';
      const slotTypeLabel = isBeardSlot ? 'Beard Only · 15 min' : 'Haircut + Beard · 40 min';
      const slotTypeColor = isBeardSlot ? 'rgba(70,130,180,0.85)' : 'rgba(51,75,51,0.85)';
      const slotTypeColorLight = isBeardSlot ? 'rgba(70,130,180,0.12)' : 'rgba(51,75,51,0.10)';

      // Booking count — use server-provided values
      const bookedCount = slot.bookingCount || 0;
      const maxCount = slot.maxBookings || (isBeardSlot ? 4 : 2);
      const spotsLeft = slot.spotsLeft ?? Math.max(maxCount - bookedCount, 0);

      // Status badge: green / amber / red based on how full
      let statusBg: string, statusColor: string, statusText: string;
      if (isTaken) {
        statusBg = 'rgba(180,0,0,0.13)'; statusColor = 'rgba(200,40,40,0.95)';
        statusText = `✖ FULL  ${bookedCount}/${maxCount}`;
      } else if (spotsLeft === 1) {
        statusBg = 'rgba(200,120,0,0.13)'; statusColor = 'rgba(190,110,0,0.95)';
        statusText = `⚠ 1 SPOT LEFT  ${bookedCount}/${maxCount}`;
      } else if (spotsLeft <= Math.ceil(maxCount / 2)) {
        statusBg = 'rgba(200,150,0,0.10)'; statusColor = 'rgba(170,120,0,0.90)';
        statusText = `◑ ${spotsLeft} SPOTS  ${bookedCount}/${maxCount}`;
      } else {
        statusBg = 'rgba(40,160,70,0.10)'; statusColor = 'rgba(30,140,60,0.95)';
        statusText = `✔ ${spotsLeft} SPOTS  ${bookedCount}/${maxCount}`;
      }
      const statusHtml = `<span class="slot-status-badge" style="background:${statusBg};color:${statusColor};">${statusText}</span>`;

      // Barber pills — now use object {count, max, full}
      const bStatus = slot.barberStatus?.bobby;
      const sStatus = slot.barberStatus?.sumit;
      const shStatus = slot.barberStatus?.shetty;

      const bobbyBg    = bStatus?.full ? 'rgba(180,0,0,0.12)' : 'rgba(40,160,70,0.10)';
      const bobbyClr   = bStatus?.full ? 'rgba(180,0,0,0.85)' : 'rgba(30,140,60,0.9)';
      const bobbyLabel = bStatus ? `Bobby ${bStatus.count}/${bStatus.max}` : 'Bobby';
      const bobbyIcon  = bStatus?.full ? '✗' : '✓';

      const sumitBg    = sStatus?.full ? 'rgba(180,0,0,0.12)' : 'rgba(40,160,70,0.10)';
      const sumitClr   = sStatus?.full ? 'rgba(180,0,0,0.85)' : 'rgba(30,140,60,0.9)';
      const sumitLabel = sStatus ? `Sumit ${sStatus.count}/${sStatus.max}` : 'Sumit';
      const sumitIcon  = sStatus?.full ? '✗' : '✓';

      const shettyBg    = shStatus?.full ? 'rgba(180,0,0,0.12)' : 'rgba(40,160,70,0.10)';
      const shettyClr   = shStatus?.full ? 'rgba(180,0,0,0.85)' : 'rgba(30,140,60,0.9)';
      const shettyLabel = shStatus ? `Shetty ${shStatus.count}/${shStatus.max}` : 'Shetty';
      const shettyIcon  = shStatus?.full ? '✗' : '✓';

      const bobbyPill = `<span style="font-size:0.58rem;background:${bobbyBg};color:${bobbyClr};padding:2px 5px;border-radius:3px;white-space:nowrap;">${bobbyIcon} ${bobbyLabel}</span>`;
      const sumitPill = `<span style="font-size:0.58rem;background:${sumitBg};color:${sumitClr};padding:2px 5px;border-radius:3px;white-space:nowrap;">${sumitIcon} ${sumitLabel}</span>`;
      const shettyPill = `<span style="font-size:0.58rem;background:${shettyBg};color:${shettyClr};padding:2px 5px;border-radius:3px;white-space:nowrap;">${shettyIcon} ${shettyLabel}</span>`;

      btn.className = `slot-btn hover-target ${isTaken ? 'taken' : ''} ${isHidden ? 'slot-hidden-type' : ''}`;
      btn.style.animationDelay = `${index * 30}ms`;
      btn.disabled = isHidden;

      btn.innerHTML = `
        <div class="slot-inner">
          <div class="slot-time-range">${slot.label || slot.time}</div>
          <div class="slot-type-badge" style="background:${slotTypeColorLight};color:${slotTypeColor};">${slotTypeLabel}</div>
          <div class="slot-status-row">${statusHtml}</div>
          <div class="slot-barber-row">${bobbyPill} ${sumitPill} ${shettyPill}</div>
        </div>
      `;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active', 'queue-active'));

        if (isTaken) {
          const joinQueue = confirm(`The ${slot.time} slot is currently fully booked.\nWould you like to join the waitlist queue for this time?`);
          if (joinQueue) {
            btn.classList.add('queue-active');
            timeInput.value = slot.time;
            queueInput.value = 'true';
            submitBtn.innerHTML = 'JOIN WAITLIST QUEUE &rarr;';
          } else {
            timeInput.value = '';
            queueInput.value = 'false';
            submitBtn.innerHTML = 'BOOK VIA WHATSAPP &rarr;';
          }
        } else {
          btn.classList.add('active');
          timeInput.value = slot.time;
          queueInput.value = 'false';
          submitBtn.innerHTML = 'BOOK VIA WHATSAPP &rarr;';
        }

        // Auto-scroll to the submit button to save scrolling on mobile/laptops
        if (timeInput.value) {
          setTimeout(() => {
            submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a temporary subtle flash highlight to the button to guide focus
            submitBtn.style.boxShadow = '0 0 20px var(--accent)';
            setTimeout(() => {
              submitBtn.style.boxShadow = '';
            }, 800);
          }, 150);
        }
      });

      timeSlotGrid.appendChild(btn);
    });
  };

  (window as any).renderSlots = renderSlots;

  // Re-render slots when service selection changes (to filter by slot type)
  serviceInput?.addEventListener('change', () => {
    if (typeof (window as any).renderSlots === 'function') {
      (window as any).renderSlots();
    }
  });


  const fetchSlots = async (date: string) => {
    if (!timeSlotGrid) return;
    timeSlotGrid.innerHTML = '<p style="grid-column: 1/-1; color: var(--theme-main); font-family: var(--font-mono);">Loading slots...</p>';
    
    try {
      // Connect to the local Express backend via Vite proxy
      const response = await fetch(`/api/slots?date=${date}`);
      const data = await response.json();
      if (data.closed) {
        timeSlotGrid.innerHTML = `<p style="grid-column: 1/-1; color: var(--theme-main); font-family: var(--font-serif); text-align: center; padding: 2rem; font-size: 1.2rem; letter-spacing: 0.05em;">🔒 Closed: ${data.message || 'Salon is closed on this date.'}</p>`;
        return;
      }
      currentSlotsData = data.slots;
      renderSlots();
    } catch {
      timeSlotGrid.innerHTML = '<p style="grid-column: 1/-1; color: red;">Failed to load slots. Is the backend running?</p>';
    }
  };

  // Fetch slots when date changes
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      if (timeInput) timeInput.value = '';
      if (queueInput) queueInput.value = 'false';
      if (submitBtn) submitBtn.innerHTML = 'BOOK VIA WHATSAPP &rarr;';
      fetchSlots((e.target as HTMLInputElement).value);
    });
    // Initial fetch
    fetchSlots(dateInput.value);
  }

  function validateBookingForm(): boolean {
    const fields = {
      name: document.getElementById('b-name') as HTMLInputElement,
      phone: document.getElementById('b-phone') as HTMLInputElement,
      gender: document.getElementById('b-gender') as HTMLSelectElement,
      service: document.getElementById('b-service') as HTMLSelectElement,
      barber: document.getElementById('b-barber') as HTMLSelectElement,
      date: document.getElementById('b-date') as HTMLInputElement,
      time: document.getElementById('b-time') as HTMLInputElement,
    };

    let isValid = true;

    // Remove old error messages
    document.querySelectorAll('.booking-error').forEach(el => el.remove());
    
    // Reset border colors
    Object.values(fields).forEach(field => {
      if (field) field.style.borderColor = '';
    });

    Object.entries(fields).forEach(([key, field]) => {
      if (!field) return;
      const value = field.value.trim();
      
      if (!value || value === '' || value === 'Select' || value === '--') {
        isValid = false;
        const error = document.createElement('span');
        error.className = 'booking-error';
        error.style.cssText = 'color: #E24B4A; font-size: 12px; display: block; margin-top: 4px; font-family: var(--font-mono);';
        
        if (key === 'time') {
          error.textContent = 'Please select a time slot from the grid';
          const grid = document.getElementById('time-slot-grid');
          grid?.parentNode?.appendChild(error);
        } else {
          error.textContent = `Please fill in your ${key}`;
          field.parentNode?.appendChild(error);
          field.style.borderColor = '#E24B4A';
        }
      }
    });

    // Phone number validation (Indian mobile: 10 digits starting with 6-9)
    if (fields.phone && fields.phone.value) {
      const phoneVal = fields.phone.value.replace(/\s/g, '');
      if (!/^[6-9]\d{9}$/.test(phoneVal)) {
        isValid = false;
        fields.phone.style.borderColor = '#E24B4A';
        const error = document.createElement('span');
        error.className = 'booking-error';
        error.style.cssText = 'color: #E24B4A; font-size: 12px; display: block; margin-top: 4px; font-family: var(--font-mono);';
        error.textContent = 'Enter a valid 10-digit Indian mobile number';
        fields.phone.parentNode?.appendChild(error);
      }
    }

    // Past date validation
    if (fields.date && fields.date.value) {
      const today = getIndiaDateString();
      if (fields.date.value < today) {
        isValid = false;
        fields.date.style.borderColor = '#E24B4A';
        const error = document.createElement('span');
        error.className = 'booking-error';
        error.style.cssText = 'color: #E24B4A; font-size: 12px; display: block; margin-top: 4px; font-family: var(--font-mono);';
        error.textContent = 'Cannot book an appointment in the past';
        fields.date.parentNode?.appendChild(error);
      }
    }

    return isValid;
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validateBookingForm()) {
        return;
      }
      
      submitBtn.innerHTML = 'PROCESSING...';
      submitBtn.disabled = true;

      const name = (document.getElementById('b-name') as HTMLInputElement).value;
      const phone = (document.getElementById('b-phone') as HTMLInputElement).value;
      const gender = (document.getElementById('b-gender') as HTMLSelectElement).value;
      const service = (document.getElementById('b-service') as HTMLSelectElement).value;
      const barber = (document.getElementById('b-barber') as HTMLSelectElement).value;
      const date = dateInput.value;
      const time = timeInput.value;
      const isQueue = queueInput.value === 'true';

      try {
        // Post booking to backend to lock the slot via Vite proxy
        const res = await fetch('/api/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, time, name, phone, gender, service, barber, isQueue })
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          showToast(errorData.error || 'Failed to book slot', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'BOOK VIA WHATSAPP &rarr;';
          return;
        }

        const whatsappNumber = '917574947065'; 
        const statusText = isQueue ? '*WAITLIST QUEUE REQUEST*' : '*NEW APPOINTMENT REQUEST*';
        const message = `Hello Bobby Salon! \n${statusText}\n\n*Details:*\nName: ${name}\nPhone: ${phone}\nGender: ${gender}\nService: ${service}\nBarber: ${barber}\nDate: ${date}\nTime: ${time}\n\n${isQueue ? 'I understand this slot is taken, but please notify me if there is a cancellation!' : 'I understand I need to arrive 10-15 minutes early. Please confirm if this slot is available. Thank you!'}`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        
        // Show confirmation modal
        const modal = document.getElementById('confirmation-modal');
        if (modal) {
          modal.innerHTML = `
            <div class="modal-content glassmorphism-dark" style="position: relative;">
              <h2 style="color: var(--theme-main); margin-bottom: 0.5rem;">Congratulations!</h2>
              <h3 style="font-family: var(--font-sans); font-size: 1.3rem; margin-bottom: 1rem; font-weight: 600;">Your Booking is Successful!</h3>
              <p style="font-size: 1.0rem; color: var(--text-secondary); margin-bottom: 1.5rem;">Opening WhatsApp to confirm your slot... If it does not redirect automatically, please click below.</p>
              <p style="font-size: 0.95rem; color: var(--theme-main); font-family: var(--font-mono); margin-bottom: 2rem; padding: 1rem; border: 1px solid var(--theme-main); border-radius: 8px;">⏳ Note: Please arrive at the salon 10-15 minutes before your appointment time (${time}).</p>
              <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button id="add-to-calendar-btn" class="hover-target" style="background: transparent; color: var(--theme-main); border: 1px solid var(--theme-main); padding: 12px 24px; border-radius: 40px; cursor: pointer; font-family: var(--font-mono); font-weight: bold;">+ ADD TO CALENDAR</button>
                <a href="${whatsappUrl}" target="_blank" id="continue-wa-btn" class="hover-target" style="background: var(--theme-main); color: white; border: none; padding: 12px 24px; border-radius: 40px; cursor: pointer; font-family: var(--font-mono); font-weight: bold; text-decoration: none;">CONFIRM ON WHATSAPP &rarr;</a>
              </div>
            </div>
          `;
          modal.style.display = 'flex';

          // Automatically redirect to WhatsApp after 2 seconds
          const redirectTimeout = setTimeout(() => {
            window.location.href = whatsappUrl;
          }, 2000);
          
          document.getElementById('add-to-calendar-btn')?.addEventListener('click', () => {
            clearTimeout(redirectTimeout);
            const startTime = new Date(`${date} ${time}`);
            const endTime = new Date(startTime.getTime() + 60*60*1000);
            
            const formatDate = (d: Date) => {
              return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            const icsString = [
              'BEGIN:VCALENDAR',
              'VERSION:2.0',
              'PRODID:-//Bobby Salon//Booking//EN',
              'BEGIN:VEVENT',
              `DTSTART:${formatDate(startTime)}`,
              `DTEND:${formatDate(endTime)}`,
              `SUMMARY:Bobby Salon - ${service}`,
              `DESCRIPTION:Appointment for ${name} with ${barber}`,
              'END:VEVENT',
              'END:VCALENDAR'
            ].join('\n');

            const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'bobby_salon_appointment.ics';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          });

          document.getElementById('continue-wa-btn')?.addEventListener('click', () => {
            clearTimeout(redirectTimeout);
            modal.style.display = 'none';
            fetchSlots(date);
            bookingForm.reset();
            dateInput.value = date;
            timeInput.value = '';
            queueInput.value = 'false';
            submitBtn.innerHTML = 'BOOK VIA WHATSAPP &rarr;';
            submitBtn.disabled = false;
          });
          
          // Global event delegation on document already handles cursor hover for all dynamic elements.
        }



      } catch {
        showToast('Server error while booking.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'BOOK VIA WHATSAPP &rarr;';
      }
    });
  }

  // Navigation Menu Logic
  const menuBtn = document.querySelector('.menu-btn') as HTMLButtonElement;
  const closeBtn = document.querySelector('.close-btn') as HTMLButtonElement;
  const fullscreenMenu = document.getElementById('fullscreen-menu') as HTMLDivElement;
  const menuBackdrop = document.getElementById('menu-backdrop') as HTMLDivElement;
  const menuLinks = document.querySelectorAll('.menu-links a');

  let scrollPos = 0;

  function openMenu() {
    fullscreenMenu.classList.add('active');
    menuBackdrop?.classList.add('active');
    document.body.classList.add('menu-open');
    
    scrollPos = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPos}px`;
    document.body.style.width = '100%';

    // Trap focus inside menu for accessibility: focus on close button
    closeBtn?.focus();
  }

  function closeMenu() {
    fullscreenMenu.classList.remove('active');
    menuBackdrop?.classList.remove('active');
    document.body.classList.remove('menu-open');
    
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollPos);
  }

  menuBtn?.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);

  // Close when clicking a menu link
  menuLinks.forEach(link => {
    link.addEventListener('click', () => closeMenu());
  });

  // Close on clicking the dark backdrop outside the panel
  menuBackdrop?.addEventListener('click', closeMenu);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fullscreenMenu?.classList.contains('active')) {
      closeMenu();
    }
  });

  // Parallax Scroll Effect - Optimized
  const header = document.querySelector('.header') as HTMLElement;
  const parallaxTexts = document.querySelectorAll('.parallax-text');
  const parallaxTextsSlow = document.querySelectorAll('.parallax-text-slow');
  const img1 = document.querySelector('.img-1') as HTMLElement;
  const img2 = document.querySelector('.img-2') as HTMLElement;
  const img3 = document.querySelector('.img-3') as HTMLElement;
  const parallaxVideo = document.querySelector('.parallax-video') as HTMLElement;
  
  let ticking = false;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    
    if (!ticking) {
      window.requestAnimationFrame(() => {
        // Toggle header background on scroll
        if (header) {
          if (scrollY > 50) {
            header.classList.add('scrolled-header');
          } else {
            header.classList.remove('scrolled-header');
          }
        }
        
        // Parallax text (force hardware accel with translateZ)
        parallaxTexts.forEach(el => {
          (el as HTMLElement).style.transform = `translateY(${scrollY * 0.5}px) translateZ(0)`;
        });

        parallaxTextsSlow.forEach(el => {
          const rect = el.parentElement?.getBoundingClientRect();
          if (rect && rect.top < window.innerHeight && rect.bottom > 0) {
            const offset = (window.innerHeight - rect.top) * 0.2;
            (el as HTMLElement).style.transform = `translateY(${offset}px) translateZ(0)`;
          }
        });

        // Parallax images
        if (img1) img1.style.transform = `translateY(${scrollY * 0.2}px) translateZ(0)`;
        if (img2) img2.style.transform = `translateY(${scrollY * 0.4}px) translateZ(0)`;
        if (img3) img3.style.transform = `translateY(${scrollY * 0.1}px) translateZ(0)`;

        // Parallax video
        if (parallaxVideo) {
          const rect = parallaxVideo.parentElement?.getBoundingClientRect();
          if (rect && rect.top < window.innerHeight && rect.bottom > 0) {
            parallaxVideo.style.transform = `translateY(${(rect.top) * 0.3}px) translateZ(0)`;
          }
        }
        
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Fade up animation observer
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-up-active');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Add fade-up base styles dynamically and observe elements
  const animateElements = document.querySelectorAll('.phil-card, .glass-panel, .masonry-item, .booking-form');
  
  animateElements.forEach(el => {
    observer.observe(el);
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = anchor.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth'
          });
        }
      }
    });
  });

  let adminPassword = sessionStorage.getItem('adminPassword') || '';
  let adminRole = sessionStorage.getItem('adminRole') || 'staff';

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (adminPassword) {
      headers.set('Authorization', `Bearer ${adminPassword}`);
    }
    return fetch(url, { ...options, headers });
  };

  let adminRefreshInterval: any = null;

  const showLoginContainer = () => {
    let loginContainer = document.getElementById('admin-login-container');
    if (!loginContainer) {
      loginContainer = document.createElement('div');
      loginContainer.id = 'admin-login-container';
      document.body.appendChild(loginContainer);
    }
    
    loginContainer.style.display = 'block';
    loginContainer.innerHTML = `
      <div class="admin-login-wrapper">
        <div class="admin-glass-panel" style="width: 100%; max-width: 420px; padding: 3rem 2.5rem; text-align: center;">
          <h2 style="font-family: var(--font-serif); font-size: 2.2rem; color: var(--theme-main); margin-bottom: 0.5rem; letter-spacing: 0.05em; text-transform: uppercase;">Bobby Salon</h2>
          <p style="font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.1em; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 2.5rem;">Admin Access Portal</p>
          
          <form id="admin-login-form" style="text-align: left;">
            <div class="admin-form-group">
              <label for="login-username" class="admin-label">Username</label>
              <input type="text" id="login-username" class="admin-input" required placeholder="e.g. bobby" />
            </div>
            
            <div class="admin-form-group">
              <label for="login-password" class="admin-label">Password</label>
              <div class="admin-password-wrapper">
                <input type="password" id="login-password" class="admin-input" required placeholder="••••••••" style="padding-right: 3rem;" />
                <button type="button" id="login-password-toggle" class="admin-password-toggle" title="Show password">
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
            </div>
            
            <div id="login-error-msg" style="display: none; color: #d32f2f; font-family: var(--font-mono); font-size: 0.75rem; margin-bottom: 1.5rem; text-align: center; padding: 0.5rem; border-radius: 6px; background: rgba(211, 47, 47, 0.05);">
              Invalid credentials. Please try again.
            </div>
            
            <button type="submit" class="admin-btn admin-btn-primary hover-target" style="width: 100%; border-radius: 10px; margin-bottom: 1rem;">Log In</button>
            
            <button type="button" id="login-cancel-btn" class="admin-btn admin-btn-secondary hover-target" style="width: 100%; border-radius: 10px;">Cancel</button>
          </form>
        </div>
      </div>
    `;

    // Add submit and cancel events
    const loginForm = document.getElementById('admin-login-form') as HTMLFormElement;
    const usernameInput = document.getElementById('login-username') as HTMLInputElement;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;
    const errorMsg = document.getElementById('login-error-msg') as HTMLElement;
    const cancelBtn = document.getElementById('login-cancel-btn') as HTMLButtonElement;
    const togglePasswordBtn = document.getElementById('login-password-toggle') as HTMLButtonElement;

    togglePasswordBtn?.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      const icon = togglePasswordBtn.querySelector('svg');
      if (icon) {
        if (type === 'text') {
          icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
          togglePasswordBtn.title = 'Hide password';
        } else {
          icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
          togglePasswordBtn.title = 'Show password';
        }
      }
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.style.display = 'none';
      const username = usernameInput.value;
      const password = passwordInput.value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        if (res.ok) {
          const data = await res.json();
          adminPassword = data.token;
          sessionStorage.setItem('adminPassword', data.token);
          checkAdmin();
        } else {
          const data = await res.json().catch(() => ({}));
          errorMsg.textContent = data.error || 'Invalid username or password.';
          errorMsg.style.display = 'block';
        }
      } catch {
        errorMsg.textContent = 'Network error. Please try again.';
        errorMsg.style.display = 'block';
      }
    });

    cancelBtn.addEventListener('click', () => {
      window.location.hash = '';
    });

    // Global event delegation on document already handles cursor hover for
    // all .hover-target, a, button, input, select — no per-element re-attach needed.
  };

  const checkAdmin = async () => {
    if (window.location.hash.startsWith('#admin')) {
      const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isBypass = window.location.search.includes('bypass=1') || window.location.hash.includes('bypass=1');
      const isLocalBypass = isLocal && isBypass;
      let pwd = adminPassword;
      if (!pwd && isLocalBypass) {
        pwd = 'bobby123';
      }

      if (pwd) {
        try {
          const testHeaders = new Headers();
          testHeaders.set('Authorization', `Bearer ${pwd}`);
          const res = await fetch('/api/admin/bookings', { headers: testHeaders });
          if (res.ok) {
            const data = await res.json();
            adminPassword = pwd;
            adminRole = data.role || 'staff';
            sessionStorage.setItem('adminPassword', pwd);
            sessionStorage.setItem('adminRole', adminRole);
            
            // Hide public page content
            Array.from(document.body.children).forEach(child => {
              if (child.id !== 'admin-container' && !child.classList.contains('custom-cursor') && !child.classList.contains('ambient-glow')) {
                (child as HTMLElement).style.display = 'none';
              }
            });
            const loginContainer = document.getElementById('admin-login-container');
            if (loginContainer) loginContainer.style.display = 'none';

            renderAdminDashboard();
            // Auto-refresh every 10 seconds
            if (!adminRefreshInterval) {
              adminRefreshInterval = setInterval(() => {
                if (window.location.hash.startsWith('#admin')) {
                  fetchAdminData();
                } else {
                  clearInterval(adminRefreshInterval);
                  adminRefreshInterval = null;
                }
              }, 10000);
            }
            return;
          } else {
            sessionStorage.removeItem('adminPassword');
            sessionStorage.removeItem('adminRole');
            adminPassword = '';
            adminRole = 'staff';
          }
        } catch {
          sessionStorage.removeItem('adminPassword');
          sessionStorage.removeItem('adminRole');
          adminPassword = '';
          adminRole = 'staff';
        }
      }

      // Hide public & admin dashboards
      Array.from(document.body.children).forEach(child => {
        if (child.id !== 'admin-login-container' && !child.classList.contains('custom-cursor') && !child.classList.contains('ambient-glow')) {
          (child as HTMLElement).style.display = 'none';
        }
      });
      const adminContainer = document.getElementById('admin-container');
      if (adminContainer) adminContainer.style.display = 'none';

      showLoginContainer();
    } else {
      if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
      }
      Array.from(document.body.children).forEach(child => {
        if (child.id !== 'admin-container' && child.id !== 'admin-login-container' && !child.classList.contains('custom-cursor') && !child.classList.contains('ambient-glow')) {
          (child as HTMLElement).style.display = '';
        }
      });
      const adminContainer = document.getElementById('admin-container');
      if (adminContainer) adminContainer.style.display = 'none';

      const loginContainer = document.getElementById('admin-login-container');
      if (loginContainer) loginContainer.style.display = 'none';
    }
  };

  window.addEventListener('hashchange', checkAdmin);
  checkAdmin();

  // Helper to calculate estimated price for services from DB
  const getServicePrice = (serviceName: string) => {
    if (!serviceName) return 0;
    const found = servicesList.find(s => s.name === serviceName);
    if (found) return found.price;
    
    // Fallback parser if not found
    const s = serviceName.toLowerCase();
    if (s.includes('haircut + beard')) return 110;
    if (s.includes('haircut + hair color')) return 120;
    if (s.includes('only haircut') || s.includes('haircut (1 hour)')) return 65;
    if (s.includes('only beard') || s.includes('clean shave')) return 45;
    if (s.includes('beard sculpting')) return 45;
    if (s.includes('facial') || s.includes('treatment') || s.includes('spa')) return 80;
    if (s.includes('massage') || s.includes('cleanup')) return 50;
    if (s.includes('color')) return 70;
    if (s.includes('wash') && s.includes('dry')) return 45;
    if (s.includes('wash')) return 30;
    return 50;
  };

  async function fetchAdminData() {
    try {
      const res = await authFetch('/api/admin/bookings');
      const data = await res.json();
      adminRole = data.role || 'staff';
      sessionStorage.setItem('adminRole', adminRole);
      
      const todayStr = getIndiaDateString();
      const totalToday = data.bookedSlots.filter((b: any) => b.date === todayStr).length;
      const totalWaitlist = data.queue.length;
      const totalCompleted = data.completedSlots.length;
      const estimatedRevenue = data.completedSlots.reduce((sum: number, b: any) => sum + getServicePrice(b.service), 0);

      // Preserve filter values before re-rendering
      const searchInputOld = document.getElementById('admin-search') as HTMLInputElement;
      const currentSearch = searchInputOld ? searchInputOld.value : '';
      const isFocused = searchInputOld && document.activeElement === searchInputOld;

      const dateFilterOld = document.getElementById('filter-date') as HTMLSelectElement;
      const currentDateFilter = dateFilterOld ? dateFilterOld.value : 'all';

      const barberFilterOld = document.getElementById('filter-barber') as HTMLSelectElement;
      const currentBarberFilter = barberFilterOld ? barberFilterOld.value : 'all';

      const statusFilterOld = document.getElementById('filter-status') as HTMLSelectElement;
      const currentStatusFilter = statusFilterOld ? statusFilterOld.value : 'all';

      let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
          <div class="admin-glass-panel" style="text-align: center; padding: 2rem;">
            <h3 style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase; margin-bottom: 0.5rem;">Today's Bookings</h3>
            <p style="color: var(--theme-main); font-family: var(--font-serif); font-size: 4rem; line-height: 1; margin: 0;">${totalToday}</p>
          </div>
          <div class="admin-glass-panel" style="text-align: center; padding: 2rem;">
            <h3 style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase; margin-bottom: 0.5rem;">Waitlist Queue</h3>
            <p style="color: #4682B4; font-family: var(--font-serif); font-size: 4rem; line-height: 1; margin: 0;">${totalWaitlist}</p>
          </div>
          <div class="admin-glass-panel" style="text-align: center; padding: 2rem;">
            <h3 style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase; margin-bottom: 0.5rem;">Total Completed</h3>
            <p style="color: #2E8B57; font-family: var(--font-serif); font-size: 4rem; line-height: 1; margin: 0;">${totalCompleted}</p>
          </div>
          <div class="admin-glass-panel" style="text-align: center; padding: 2rem;">
            <h3 style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase; margin-bottom: 0.5rem;">Estimated Earnings</h3>
            <p style="color: #FF8C00; font-family: var(--font-serif); font-size: 4rem; line-height: 1; margin: 0;">INR ${estimatedRevenue}</p>
          </div>
        </div>

        <div style="margin-bottom: 3rem; display: flex; gap: 1rem; flex-wrap: wrap;">
          <button id="toggle-manual-booking-btn" class="admin-btn admin-btn-primary hover-target">+ Add Manual Booking</button>
          <button id="export-bookings-csv-btn" class="admin-btn admin-btn-secondary hover-target">Export CSV</button>
          
          <div id="manual-booking-form-wrap" class="admin-modal-overlay">
            <div class="admin-glass-panel admin-modal-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h3 style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--theme-main); margin: 0;">Add Manual Appointment</h3>
                <button type="button" id="mb-close-btn" class="hover-target" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-secondary);">&times;</button>
              </div>
              <form id="admin-manual-booking-form">
                <div style="display:flex; gap:1rem; margin-bottom:1rem; flex-wrap: wrap;">
                  <div style="flex:1; min-width: 200px;">
                    <label class="admin-label">Name</label>
                    <input type="text" id="mb-name" required class="admin-input" placeholder="e.g. Rahul Sharma">
                  </div>
                  <div style="flex:1; min-width: 200px;">
                    <label class="admin-label">Phone</label>
                    <input type="tel" id="mb-phone" required class="admin-input" placeholder="e.g. 9876543210">
                  </div>
                </div>
                <div style="display:flex; gap:1rem; margin-bottom:1rem; flex-wrap: wrap;">
                  <div style="flex:1; min-width: 200px;">
                    <label class="admin-label">Gender</label>
                    <select id="mb-gender" required class="admin-select">
                      <option value="" disabled selected>Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div style="flex:1; min-width: 200px;">
                    <label class="admin-label">Service</label>
                    <select id="mb-service" required class="admin-select">
                      <option value="" disabled selected>Select Gender First</option>
                    </select>
                  </div>
                </div>
                <div style="display:flex; gap:1rem; margin-bottom:1rem; flex-wrap: wrap;">
                  <div style="flex:1; min-width: 200px;">
                    <label class="admin-label">Barber</label>
                    <select id="mb-barber" required class="admin-select">
                      <option value="Any Available">Any Available</option>
                      <option value="Bobby">Bobby</option>
                      <option value="Sumit">Sumit</option>
                      <option value="shetty Bhai">shetty Bhai</option>
                    </select>
                  </div>
                  <div style="flex:1; min-width: 200px;">
                    <label class="admin-label">Date</label>
                    <input type="date" id="mb-date" class="admin-input" required>
                  </div>
                </div>
                <div class="admin-form-group">
                  <label class="admin-label">Time Slot</label>
                  <select id="mb-time" required class="admin-select">
                    <option value="" disabled selected>Select Date First</option>
                  </select>
                </div>
                <div style="display:flex; gap:1rem; justify-content: flex-end; margin-top: 2rem;">
                  <button type="button" id="mb-cancel-btn" class="admin-btn admin-btn-secondary hover-target">Cancel</button>
                  <button type="submit" class="admin-btn admin-btn-primary hover-target">Book Slot</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        
        <!-- Search Bar with wrapper -->
        <div class="admin-search-wrapper">
          <svg class="admin-search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="admin-search" class="admin-search-input" placeholder="Search client name, phone, service or barber...">
        </div>
        
        <!-- Advanced Filters Bar -->
        <div class="admin-filters-bar">
          <select id="filter-date" class="admin-filter-select hover-target">
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="week">Next 7 Days</option>
          </select>
          <select id="filter-barber" class="admin-filter-select hover-target">
            <option value="all">All Barbers</option>
            <option value="bobby">Bobby</option>
            <option value="sumit">Sumit</option>
            <option value="shetty Bhai">Shetty Bhai</option>
          </select>
          <select id="filter-status" class="admin-filter-select hover-target">
            <option value="all">All Statuses</option>
            <option value="booked">Booked Slots</option>
            <option value="waitlist">Waitlist Queue</option>
            <option value="completed">Completed History</option>
          </select>
        </div>
      `;

      // Booked slots table
      html += `
        <div id="wrap-bookings" style="margin-bottom: 3rem;">
          <h2 id="hdr-bookings" style="margin-top: 0; color: var(--theme-main); font-family: var(--font-serif); font-size: 2.2rem; margin-bottom: 1rem;">Booked Slots</h2>
          <div class="admin-table-container">
            <table class="admin-table" id="table-bookings">
              <thead>
                <tr>
                  <th class="admin-th">Date</th>
                  <th class="admin-th">Time</th>
                  <th class="admin-th">Name</th>
                  <th class="admin-th">Phone</th>
                  <th class="admin-th">Service</th>
                  <th class="admin-th">Barber</th>
                  <th class="admin-th">Actions</th>
                </tr>
              </thead>
              <tbody>
      `;
      data.bookedSlots.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.time.localeCompare(b.time));
      data.bookedSlots.forEach((b: any) => {
        const deleteBtn = `<button class="admin-action-btn admin-btn admin-btn-sm admin-btn-danger hover-target" data-action="delete" data-id="${escapeHtml(b.createdAt)}">Cancel</button>`;
        const waLink = `https://wa.me/${b.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${b.name}! This is Bobby Salon. Your booking for ${b.service} on ${b.date} at ${b.time} with ${b.barber} is confirmed. See you soon!`)}`;
        
        html += `
          <tr class="admin-table-row" data-search="${escapeHtml(b.name.toLowerCase())} ${escapeHtml(b.phone)} ${escapeHtml(b.service.toLowerCase())} ${escapeHtml((b.barber || '').toLowerCase())}" data-date="${escapeHtml(b.date)}" data-barber="${escapeHtml(b.barber || 'Any Available')}" data-status="booked">
            <td class="admin-td">${escapeHtml(b.date)}</td>
            <td class="admin-td"><strong>${escapeHtml(b.time)}</strong></td>
            <td class="admin-td">${escapeHtml(b.name)}</td>
            <td class="admin-td">${escapeHtml(b.phone)}</td>
            <td class="admin-td">${escapeHtml(b.service)}</td>
            <td class="admin-td"><span class="admin-badge admin-badge-booked">${escapeHtml(b.barber || 'N/A')}</span></td>
            <td class="admin-td" style="white-space: nowrap;">
              <button class="admin-action-btn admin-btn admin-btn-sm admin-btn-primary hover-target" data-action="complete" data-id="${escapeHtml(b.createdAt)}" style="margin-right: 5px;">Complete</button>
              <a href="${waLink}" target="_blank" class="admin-btn admin-btn-sm admin-btn-secondary hover-target" style="margin-right: 5px; text-decoration: none;">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; margin-right: 3px; vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>Reminder
              </a>
              ${deleteBtn}
            </td>
          </tr>
        `;
      });
      if (data.bookedSlots.length === 0) {
        html += `<tr><td colspan="7" class="admin-td" style="text-align: center; color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.8rem; padding: 2rem 0;">No booked slots found.</td></tr>`;
      }
      html += '</tbody></table></div></div>';

      // Waitlist Queue table
      html += `
        <div id="wrap-queue" style="margin-bottom: 3rem;">
          <h2 id="hdr-queue" style="color: var(--theme-main); font-family: var(--font-serif); font-size: 2.2rem; margin-bottom: 1rem;">Waitlist Queue</h2>
          <div class="admin-table-container">
            <table class="admin-table" id="table-queue">
              <thead>
                <tr>
                  <th class="admin-th">Date</th>
                  <th class="admin-th">Time</th>
                  <th class="admin-th">Name</th>
                  <th class="admin-th">Phone</th>
                  <th class="admin-th">Service</th>
                  <th class="admin-th">Barber</th>
                  <th class="admin-th">Actions</th>
                </tr>
              </thead>
              <tbody>
      `;
      data.queue.forEach((b: any) => {
        const deleteBtn = `<button class="admin-action-btn admin-btn admin-btn-sm admin-btn-danger hover-target" data-action="delete" data-id="${escapeHtml(b.createdAt)}">Cancel</button>`;
        html += `
          <tr class="admin-table-row" data-search="${escapeHtml(b.name.toLowerCase())} ${escapeHtml(b.phone)} ${escapeHtml(b.service.toLowerCase())} ${escapeHtml((b.barber || '').toLowerCase())}" data-date="${escapeHtml(b.date)}" data-barber="${escapeHtml(b.barber || 'Any Available')}" data-status="waitlist">
            <td class="admin-td">${escapeHtml(b.date)}</td>
            <td class="admin-td"><strong>${escapeHtml(b.time)}</strong></td>
            <td class="admin-td">${escapeHtml(b.name)}</td>
            <td class="admin-td">${escapeHtml(b.phone)}</td>
            <td class="admin-td">${escapeHtml(b.service)}</td>
            <td class="admin-td"><span class="admin-badge admin-badge-waitlist">${escapeHtml(b.barber || 'N/A')}</span></td>
            <td class="admin-td" style="white-space: nowrap;">
              <button class="admin-action-btn admin-btn admin-btn-sm admin-btn-primary hover-target" data-action="approve" data-id="${escapeHtml(b.createdAt)}" style="margin-right: 5px;">Approve</button>
              ${deleteBtn}
            </td>
          </tr>
        `;
      });
      if (data.queue.length === 0) {
        html += `<tr><td colspan="7" class="admin-td" style="text-align: center; color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.8rem; padding: 2rem 0;">No waitlisted clients.</td></tr>`;
      }
      html += '</tbody></table></div></div>';

      // Completed History table
      html += `
        <div id="wrap-completed">
          <h2 id="hdr-completed" style="color: var(--text-secondary); font-family: var(--font-serif); font-size: 2.2rem; margin-bottom: 1rem;">Completed History</h2>
          <div class="admin-table-container" style="opacity: 0.85;">
            <table class="admin-table" id="table-completed">
              <thead>
                <tr>
                  <th class="admin-th">Date</th>
                  <th class="admin-th">Time</th>
                  <th class="admin-th">Name</th>
                  <th class="admin-th">Phone</th>
                  <th class="admin-th">Service</th>
                  <th class="admin-th">Barber</th>
                </tr>
              </thead>
              <tbody>
      `;
      data.completedSlots.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.time.localeCompare(b.time));
      data.completedSlots.forEach((b: any) => {
        html += `
          <tr class="admin-table-row" data-search="${escapeHtml(b.name.toLowerCase())} ${escapeHtml(b.phone)} ${escapeHtml(b.service.toLowerCase())} ${escapeHtml((b.barber || '').toLowerCase())}" data-date="${escapeHtml(b.date)}" data-barber="${escapeHtml(b.barber || 'Any Available')}" data-status="completed">
            <td class="admin-td">${escapeHtml(b.date)}</td>
            <td class="admin-td"><strong>${escapeHtml(b.time)}</strong></td>
            <td class="admin-td">${escapeHtml(b.name)}</td>
            <td class="admin-td">${escapeHtml(b.phone)}</td>
            <td class="admin-td">${escapeHtml(b.service)}</td>
            <td class="admin-td"><span class="admin-badge admin-badge-completed">${escapeHtml(b.barber || 'N/A')}</span></td>
          </tr>
        `;
      });
      if (data.completedSlots.length === 0) {
        html += `<tr><td colspan="6" class="admin-td" style="text-align: center; color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.8rem; padding: 2rem 0;">No completed history yet.</td></tr>`;
      }
      html += '</tbody></table></div></div>';

      const adminContentDiv = document.getElementById('admin-content');
      if (adminContentDiv) {
        adminContentDiv.innerHTML = html;
        
        // Restore filter values in DOM
        const searchInput = document.getElementById('admin-search') as HTMLInputElement;
        const dateSelect = document.getElementById('filter-date') as HTMLSelectElement;
        const barberSelect = document.getElementById('filter-barber') as HTMLSelectElement;
        const statusSelect = document.getElementById('filter-status') as HTMLSelectElement;

        if (searchInput) {
          searchInput.value = currentSearch;
          if (isFocused) searchInput.focus();
        }
        if (dateSelect) dateSelect.value = currentDateFilter;
        if (barberSelect) barberSelect.value = currentBarberFilter;
        if (statusSelect) statusSelect.value = currentStatusFilter;

        // Apply filters function
        const applyFilters = () => {
          const query = searchInput ? searchInput.value.toLowerCase() : '';
          const dateVal = dateSelect ? dateSelect.value : 'all';
          const barberVal = barberSelect ? barberSelect.value : 'all';
          const statusVal = statusSelect ? statusSelect.value : 'all';

          const today = getIndiaDateString();
          const tomorrow = getTomorrowDateString();
          const nextWeekDate = new Date();
          nextWeekDate.setDate(nextWeekDate.getDate() + 7);
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const nextWeekStr = formatter.format(nextWeekDate);

          document.querySelectorAll('.admin-table-row').forEach(row => {
            const el = row as HTMLElement;
            const rSearch = el.dataset.search || '';
            const rDate = el.dataset.date || '';
            const rBarber = el.dataset.barber || '';
            const rStatus = el.dataset.status || '';

            const matchSearch = !query || rSearch.includes(query);
            
            let matchDate = true;
            if (dateVal === 'today') {
              matchDate = rDate === today;
            } else if (dateVal === 'tomorrow') {
              matchDate = rDate === tomorrow;
            } else if (dateVal === 'week') {
              matchDate = rDate >= today && rDate <= nextWeekStr;
            }

            let matchBarber = true;
            if (barberVal !== 'all') {
              matchBarber = rBarber.toLowerCase() === barberVal.toLowerCase() ||
                            (barberVal.toLowerCase() === 'shetty bhai' && rBarber.toLowerCase().includes('shetty'));
            }

            let matchStatus = true;
            if (statusVal !== 'all') {
              matchStatus = rStatus === statusVal;
            }

            const visible = matchSearch && matchDate && matchBarber && matchStatus;
            el.style.display = visible ? '' : 'none';
          });

          // Toggle section wrappers
          const updateSection = (containerId: string, statusType: string) => {
            const wrap = document.getElementById(containerId);
            if (!wrap) return;

            if (statusVal !== 'all' && statusVal !== statusType) {
              wrap.style.display = 'none';
              return;
            }

            const visibleRows = wrap.querySelectorAll('.admin-table-row:not([style*="display: none"])');
            wrap.style.display = visibleRows.length > 0 ? 'block' : 'none';
          };

          updateSection('wrap-bookings', 'booked');
          updateSection('wrap-queue', 'waitlist');
          updateSection('wrap-completed', 'completed');
        };

        // Attach listeners
        [searchInput, dateSelect, barberSelect, statusSelect].forEach(el => {
          el?.addEventListener('input', applyFilters);
          el?.addEventListener('change', applyFilters);
        });

        // Run initially to apply any preserved filters
        applyFilters();

        // Bind CSV Exporter
        const exportBtn = document.getElementById('export-bookings-csv-btn');
        exportBtn?.addEventListener('click', () => {
          const headers = ['Date', 'Time', 'Name', 'Phone', 'Service', 'Barber', 'Status'];
          const rows: any[] = [];
          
          data.bookedSlots.forEach((b: any) => {
            rows.push([b.date, b.time, b.name, b.phone, b.service, b.barber || 'N/A', 'Booked']);
          });
          data.queue.forEach((b: any) => {
            rows.push([b.date, b.time, b.name, b.phone, b.service, b.barber || 'N/A', 'Waitlist']);
          });
          data.completedSlots.forEach((b: any) => {
            rows.push([b.date, b.time, b.name, b.phone, b.service, b.barber || 'N/A', 'Completed']);
          });

          const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...rows.map(r => r.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
            
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", `bobby_salon_bookings_${getIndiaDateString()}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast('CSV export successful!', 'success');
        });

        // Modal overlay toggle for manual booking form
        const toggleBtn = document.getElementById('toggle-manual-booking-btn');
        const formWrap = document.getElementById('manual-booking-form-wrap');
        const cancelBtn = document.getElementById('mb-cancel-btn');
        const closeBtn = document.getElementById('mb-close-btn');

        if (toggleBtn && formWrap) {
          toggleBtn.addEventListener('click', () => {
            formWrap.classList.add('active');
          });
          const hideModal = () => {
            formWrap.classList.remove('active');
          };
          cancelBtn?.addEventListener('click', hideModal);
          closeBtn?.addEventListener('click', hideModal);
        }

        // Gender changes in manual booking
        const mbGender = document.getElementById('mb-gender') as HTMLSelectElement;
        const mbService = document.getElementById('mb-service') as HTMLSelectElement;
        const mbBarber = document.getElementById('mb-barber') as HTMLSelectElement;
        if (mbGender && mbService) {
          mbGender.addEventListener('change', () => {
            const gender = mbGender.value;
            mbService.innerHTML = '<option value="" disabled selected>Select Service</option>';
            const filtered = servicesList.filter((s: any) => s.gender === gender);
            filtered.forEach((s: any) => {
              const opt = document.createElement('option');
              opt.value = s.name; opt.textContent = s.name;
              mbService.appendChild(opt);
            });
            if (gender === 'Female') {
              mbBarber.innerHTML = '<option value="Sumit" selected>Sumit (Specialist)</option>';
            } else {
              mbBarber.innerHTML = `
                <option value="Any Available">Any Available</option>
                <option value="Bobby">Bobby</option>
                <option value="Sumit">Sumit</option>
                <option value="shetty Bhai">shetty Bhai</option>
              `;
            }
          });
        }

        // Date changes in manual booking
        const mbDate = document.getElementById('mb-date') as HTMLInputElement;
        const mbTime = document.getElementById('mb-time') as HTMLSelectElement;
        if (mbDate && mbTime) {
          const today = getIndiaDateString();
          mbDate.min = today;
          mbDate.value = today;

          const loadMbSlots = async () => {
            const date = mbDate.value;
            mbTime.innerHTML = '<option value="" disabled selected>Loading slots...</option>';
            try {
              const res = await fetch(`/api/slots?date=${date}`);
              const data = await res.json();
              mbTime.innerHTML = '<option value="" disabled selected>Select Time</option>';
              (data.slots || []).forEach((s: any) => {
                if (s.isBreak) return; // skip break slots
                const opt = document.createElement('option');
                opt.value = s.time;
                const typeLabel = s.type === 'beard_only' ? '(Beard Only)' : '(Haircut+Beard)';
                const statusLabel = s.taken ? ' — FULL' : (s.bookingCount === 1 ? ' — 1 spot left' : '');
                opt.textContent = `${s.label || s.time} ${typeLabel}${statusLabel}`;
                if (s.isBreak) opt.disabled = true;
                mbTime.appendChild(opt);
              });
            } catch {
              mbTime.innerHTML = '<option value="" disabled selected>Error loading slots</option>';
            }
          };

          mbDate.addEventListener('change', () => {
            mbTime.value = '';
            loadMbSlots();
          });

          // Load today's slots initially
          loadMbSlots();
        }

        // Handle manual booking submit
        const mbForm = document.getElementById('admin-manual-booking-form') as HTMLFormElement;
        if (mbForm && formWrap) {
          mbForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = (document.getElementById('mb-name') as HTMLInputElement).value;
            const phone = (document.getElementById('mb-phone') as HTMLInputElement).value;
            const gender = mbGender.value;
            const service = mbService.value;
            const barber = mbBarber.value;
            const date = mbDate.value;
            const time = mbTime.value;

            try {
              const res = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, time, name, phone, gender, service, barber, isQueue: false })
              });
              if (res.ok) {
                showToast('Manual booking created successfully!', 'success');
                formWrap.classList.remove('active');
                fetchAdminData();
              } else {
                const err = await res.json();
                showToast(err.error || 'Failed to book slot', 'error');
              }
            } catch {
              showToast('Network error while manual booking.', 'error');
            }
          });
        }
      }
    } catch {
      const adminContentDiv = document.getElementById('admin-content');
      if (adminContentDiv) adminContentDiv.innerHTML = '<p style="color:red; font-family: var(--font-mono);">Error loading data</p>';
    }
  }

  async function renderAdminDashboard() {
    let container = document.getElementById('admin-container');
    // Hide original page content
    Array.from(document.body.children).forEach(child => {
      if (child.id !== 'admin-container' && !child.classList.contains('custom-cursor') && !child.classList.contains('ambient-glow')) {
        (child as HTMLElement).style.display = 'none';
      }
    });

    if (!container) {
      container = document.createElement('div');
      container.id = 'admin-container';
      document.body.appendChild(container);
      
      container.innerHTML = `
        <div class="admin-dashboard-layout">
          <!-- Sidebar Nav -->
          <aside class="admin-sidebar">
            <div>
              <div style="margin-bottom: 2rem;">
                <h1 style="color: var(--theme-main); font-family: var(--font-serif); font-size: 2.2rem; margin: 0; letter-spacing: 0.05em; text-transform: uppercase;">Bobby Salon</h1>
                <p style="font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.1em; color: var(--text-secondary); text-transform: uppercase; margin-top: 0.2rem;">Management Workspace</p>
              </div>
              
              <nav>
                <ul class="admin-nav-list">
                  <li>
                    <button id="tab-bookings" class="admin-nav-item active hover-target" onclick="window._adminTab('bookings')">
                      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      Bookings
                    </button>
                  </li>
                  <li>
                    <button id="tab-services" class="admin-nav-item hover-target" onclick="window._adminTab('services')">
                      <svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                      Services
                    </button>
                  </li>
                  <li>
                    <button id="tab-analytics" class="admin-nav-item hover-target" onclick="window._adminTab('analytics')">
                      <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                      Analytics
                    </button>
                  </li>
                  <li>
                    <button id="tab-gallery" class="admin-nav-item hover-target" onclick="window._adminTab('gallery')">
                      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      Gallery
                    </button>
                  </li>
                  <li>
                    <button id="tab-settings" class="admin-nav-item hover-target" onclick="window._adminTab('settings')">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                      Settings
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <button id="admin-logout-btn" class="admin-btn admin-btn-danger hover-target" style="width: 100%;">
                <svg viewBox="0 0 24 24" style="stroke: currentColor; width: 16px; height: 16px; fill: none; stroke-width: 2;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Logout
              </button>
              <a href="/" class="admin-btn admin-btn-secondary hover-target" style="text-decoration: none;" onclick="window.location.reload()">
                <svg viewBox="0 0 24 24" style="stroke: currentColor; width: 16px; height: 16px; fill: none; stroke-width: 2;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Back to Site
              </a>
            </div>
          </aside>
          
          <!-- Main Content -->
          <main class="admin-main-content">
            <!-- Bookings Panel -->
            <div id="panel-bookings">
              <div id="admin-content" class="admin-glass-panel">
                <div class="spinner"></div>
                <p style="text-align: center; margin-top: 1rem; font-family: var(--font-mono); color: var(--theme-main);">Loading data...</p>
              </div>
            </div>
  
            <!-- Services Panel -->
            <div id="panel-services" style="display:none;">
              <div class="admin-glass-panel" style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                  <h2 style="font-family: var(--font-serif); font-size: 2rem; color: var(--theme-main); margin: 0;">Manage Services</h2>
                  <button id="admin-add-service-btn" class="admin-btn admin-btn-primary hover-target">+ Add Service</button>
                </div>
                
                <!-- Services Cards Catalog Container -->
                <div id="admin-services-table-body" class="admin-services-grid">
                  <!-- Dynamic Service Cards -->
                </div>
              </div>

              <!-- Service Form Modal Overlay -->
              <div id="admin-service-form-wrap" class="admin-modal-overlay">
                <div class="admin-glass-panel admin-modal-card">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3 id="admin-service-form-title" style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--theme-main); margin: 0;">Add New Service</h3>
                    <button type="button" id="admin-service-form-close-btn" class="hover-target" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-secondary);">&times;</button>
                  </div>
                  <form id="admin-service-form">
                    <input type="hidden" id="as-id" />
                    
                    <div class="admin-form-group">
                      <label for="as-name" class="admin-label">Service Name</label>
                      <input type="text" id="as-name" required class="admin-input" placeholder="e.g. Premium Haircut">
                    </div>
                    
                    <div class="admin-form-group">
                      <label for="as-gender" class="admin-label">Gender Type</label>
                      <select id="as-gender" required class="admin-select">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Unisex">Unisex</option>
                      </select>
                    </div>
                    
                    <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                      <div class="admin-form-group" style="flex: 1; min-width: 150px;">
                        <label for="as-duration" class="admin-label">Duration (mins)</label>
                        <input type="number" id="as-duration" required class="admin-input" placeholder="30" min="5">
                      </div>
                      <div class="admin-form-group" style="flex: 1; min-width: 150px;">
                        <label for="as-price" class="admin-label">Price (INR)</label>
                        <input type="number" id="as-price" required class="admin-input" placeholder="100" min="0">
                      </div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                      <button type="button" id="admin-service-form-cancel-btn" class="admin-btn admin-btn-secondary hover-target">Cancel</button>
                      <button type="submit" class="admin-btn admin-btn-primary hover-target">Save Service</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
  
            <!-- Analytics Panel -->
            <div id="panel-analytics" style="display:none;">
              <div class="admin-glass-panel" style="margin-bottom: 2rem;">
                <h2 style="font-family: var(--font-serif); font-size: 2rem; color: var(--theme-main); margin-bottom: 1.5rem;">Business Analytics</h2>
                <div id="analytics-content">
                  <div class="spinner"></div>
                  <p style="text-align: center; margin-top: 1rem; font-family: var(--font-mono); color: var(--theme-main);">Loading analytics...</p>
                </div>
              </div>
            </div>
  
            <!-- Gallery Panel -->
            <div id="panel-gallery" style="display:none;">
              <div class="admin-glass-panel" style="margin-bottom: 2rem;">
                <h2 style="font-family: var(--font-serif); font-size: 2rem; color: var(--theme-main); margin-bottom: 1.5rem;">Upload New Media</h2>
                
                <!-- Drop Zone -->
                <div id="gallery-drop-zone" style="border: 2px dashed var(--theme-main); border-radius: 16px; padding: 3rem; text-align: center; cursor: pointer; transition: all 0.3s; background: rgba(255,255,255,0.3);">
                  <div style="font-size: 3rem; margin-bottom: 1rem;">📂</div>
                  <p style="font-family: var(--font-mono); color: var(--theme-main); margin-bottom: 0.5rem; font-size: 1rem; letter-spacing: 0.1em;">DROP FILES HERE</p>
                  <p style="font-family: var(--font-sans); color: var(--text-secondary); font-size: 0.875rem;">or click to browse · JPG, PNG, WEBP, MP4 · Max 200MB each</p>
                  <input type="file" id="gallery-file-input" multiple accept="image/jpeg,image/png,image/webp,video/mp4" style="display:none;" />
                </div>
  
                <!-- Upload Progress -->
                <div id="upload-progress" style="display:none; margin-top: 1.5rem;">
                  <div style="background: rgba(0,0,0,0.05); border-radius: 40px; overflow: hidden; height: 8px;">
                    <div id="upload-bar" style="height: 100%; background: var(--theme-main); width: 0%; transition: width 0.3s; border-radius: 40px;"></div>
                  </div>
                  <p id="upload-status" style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center;"></p>
                </div>
              </div>
  
              <!-- Gallery Grid -->
              <div class="admin-glass-panel">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                  <h2 style="font-family: var(--font-serif); font-size: 2rem; color: var(--theme-main); margin: 0;">Portfolio Collection</h2>
                  <span id="gallery-count" style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-secondary); background: rgba(0,0,0,0.05); padding: 0.5rem 1rem; border-radius: 40px;"></span>
                </div>
                <div id="gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem;">
                  <div class="spinner" style="grid-column: 1/-1;"></div>
                </div>
              </div>
            </div>
  
            <!-- Settings Panel -->
            <div id="panel-settings" style="display:none;">
              <div class="admin-glass-panel" style="margin-bottom: 2rem;">
                <h2 style="font-family: var(--font-serif); font-size: 2rem; color: var(--theme-main); margin-bottom: 1.5rem;">Salon Timing Settings</h2>
                <form id="admin-settings-form" style="max-width: 600px;">
                  <!-- Weekday -->
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 1rem;">
                    <span style="font-family: var(--font-mono); font-size: 0.9rem; font-weight: bold; width: 120px;">Weekdays:</span>
                    <div style="display:flex; gap: 0.5rem; align-items:center;">
                      <select id="settings-wd-start" class="admin-select" style="padding: 0.5rem 2rem 0.5rem 0.5rem; font-size: 0.85rem;"></select>
                      <span>to</span>
                      <select id="settings-wd-end" class="admin-select" style="padding: 0.5rem 2rem 0.5rem 0.5rem; font-size: 0.85rem;"></select>
                    </div>
                  </div>
                  <!-- Saturday -->
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 1rem;">
                    <span style="font-family: var(--font-mono); font-size: 0.9rem; font-weight: bold; width: 120px;">Saturdays:</span>
                    <div style="display:flex; gap: 0.5rem; align-items:center;">
                      <select id="settings-sat-start" class="admin-select" style="padding: 0.5rem 2rem 0.5rem 0.5rem; font-size: 0.85rem;"></select>
                      <span>to</span>
                      <select id="settings-sat-end" class="admin-select" style="padding: 0.5rem 2rem 0.5rem 0.5rem; font-size: 0.85rem;"></select>
                    </div>
                  </div>
                  <!-- Sunday -->
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                    <span style="font-family: var(--font-mono); font-size: 0.9rem; font-weight: bold; width: 120px;">Sundays:</span>
                    <div style="display:flex; gap: 0.5rem; align-items:center;">
                      <select id="settings-sun-start" class="admin-select" style="padding: 0.5rem 2rem 0.5rem 0.5rem; font-size: 0.85rem;"></select>
                      <span>to</span>
                      <select id="settings-sun-end" class="admin-select" style="padding: 0.5rem 2rem 0.5rem 0.5rem; font-size: 0.85rem;"></select>
                    </div>
                  </div>
                  <button type="submit" class="admin-btn admin-btn-primary hover-target">Save Hours</button>
                </form>
              </div>
  
              <!-- Blocked Dates -->
              <div class="admin-glass-panel">
                <h2 style="font-family: var(--font-serif); font-size: 2rem; color: var(--theme-main); margin-bottom: 1.5rem;">Holidays & Blocked Dates</h2>
                <form id="admin-blocked-dates-form" style="display:flex; gap:1rem; margin-bottom: 2rem; max-width: 500px; align-items:flex-end;">
                  <div style="flex:1;">
                    <label class="admin-label">BLOCK A DATE</label>
                    <input type="date" id="block-date-input" class="admin-input" required>
                  </div>
                  <button type="submit" class="admin-btn admin-btn-danger hover-target" style="border-radius: 10px;">Block Date</button>
                </form>
                <div id="blocked-dates-list-wrap">
                  <h3 style="font-family: var(--font-serif); font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 1rem;">Blocked Dates List</h3>
                  <ul id="blocked-dates-list" style="list-style:none; padding:0; display:flex; flex-direction:column; gap:0.5rem;"></ul>
                </div>
              </div>
            </div>
          </main>
        </div>
      `;

      if (adminRole === 'staff') {
        const staffHiddenTabs = ['tab-services', 'tab-analytics', 'tab-gallery', 'tab-settings'];
        staffHiddenTabs.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            const li = el.closest('li');
            if (li) li.style.display = 'none';
            else el.style.display = 'none';
          }
        });
      }

      // Tab switcher
      (window as any)._adminTab = (tab: string) => {
        if (adminRole === 'staff' && tab !== 'bookings') {
          return;
        }
        const bPanel = document.getElementById('panel-bookings')!;
        const svPanel = document.getElementById('panel-services')!;
        const aPanel = document.getElementById('panel-analytics')!;
        const gPanel = document.getElementById('panel-gallery')!;
        const sPanel = document.getElementById('panel-settings')!;
        
        const bTab   = document.getElementById('tab-bookings')!;
        const svTab  = document.getElementById('tab-services')!;
        const aTab   = document.getElementById('tab-analytics')!;
        const gTab   = document.getElementById('tab-gallery')!;
        const sTab   = document.getElementById('tab-settings')!;

        const panels = [bPanel, svPanel, aPanel, gPanel, sPanel];
        const tabs = [bTab, svTab, aTab, gTab, sTab];

        panels.forEach(p => { if (p) p.style.display = 'none'; });
        tabs.forEach(t => {
          if (t) {
            t.classList.remove('active');
          }
        });

        const currentTabBtn = document.getElementById(`tab-${tab}`);
        if (currentTabBtn) {
          currentTabBtn.classList.add('active');
        }

        if (tab === 'bookings') {
          if (bPanel) bPanel.style.display = '';
          fetchAdminData();
        } else if (tab === 'services') {
          if (svPanel) svPanel.style.display = '';
          fetchAdminServicesData();
        } else if (tab === 'analytics') {
          if (aPanel) aPanel.style.display = '';
          fetchAnalyticsData();
        } else if (tab === 'settings') {
          if (sPanel) sPanel.style.display = '';
          fetchSettingsData();
        } else if (tab === 'gallery') {
          if (gPanel) gPanel.style.display = '';
          fetchGalleryData();
        }
      };

      // ── Drop Zone logic ──────────────────────────
      const dropZone = document.getElementById('gallery-drop-zone')!;
      const fileInput = document.getElementById('gallery-file-input') as HTMLInputElement;

      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.background = 'rgba(51,75,51,0.1)'; dropZone.style.borderStyle = 'solid'; });
      dropZone.addEventListener('dragleave', () => { dropZone.style.background = 'rgba(255,255,255,0.3)'; dropZone.style.borderStyle = 'dashed'; });
      dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.style.background = 'rgba(255,255,255,0.3)'; dropZone.style.borderStyle = 'dashed'; if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files); });
      fileInput.addEventListener('change', () => { if (fileInput.files?.length) uploadFiles(fileInput.files); fileInput.value = ''; });

      // ── Upload ────────────────────────────────────
      const uploadFiles = async (files: FileList) => {
        const progress = document.getElementById('upload-progress')!;
        const bar = document.getElementById('upload-bar')!;
        const status = document.getElementById('upload-status')!;
        progress.style.display = 'block';
        bar.style.width = '10%';
        status.textContent = `Uploading ${files.length} file(s)…`;

        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('files', f));

        try {
          bar.style.width = '40%';
          const res = await authFetch('/api/admin/gallery/upload', { method: 'POST', body: formData });
          bar.style.width = '80%';
          const data = await res.json();
          if (res.ok) {
            bar.style.width = '100%';
            bar.style.background = '#2E8B57';
            status.textContent = `✅ Uploaded ${data.files.length} file(s) successfully!`;
            setTimeout(() => { progress.style.display = 'none'; bar.style.width = '0%'; bar.style.background = 'var(--theme-main)'; fetchGalleryData(); }, 2000);
          } else {
            bar.style.background = 'red';
            status.textContent = `❌ Error: ${data.error}`;
          }
        } catch {
          bar.style.background = 'red';
          status.textContent = '❌ Upload failed — server error';
        }
      };

      // ── Bookings action handler ───────────────────
      document.body.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;

        // Gallery delete
        if (target.matches('.gallery-delete-btn')) {
          const publicId = target.dataset.publicid!;
          const filename = target.dataset.file!;
          if (!confirm(`Delete "${filename}" from portfolio?`)) return;
          target.textContent = '…';
          target.style.opacity = '0.5';
          const res = await authFetch(`/api/admin/gallery/${encodeURIComponent(publicId)}`, { method: 'DELETE' });
          if (res.ok) { showToast('Media deleted successfully!', 'success'); fetchGalleryData(); }
          else { showToast('Delete failed', 'error'); target.textContent = 'Delete'; target.style.opacity = '1'; }
          return;
        }

        // Gallery rename
        if (target.matches('.gallery-rename-btn')) {
          const publicId = target.dataset.publicid!;
          const filename = target.dataset.file!;
          const ext = filename.split('.').pop();
          const newName = prompt(`Rename "${filename}" to:`, filename.replace(`.${ext}`, ''));
          if (!newName) return;
          const res = await authFetch(`/api/admin/gallery/${encodeURIComponent(publicId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName: `${newName}.${ext}` })
          });
          if (res.ok) { showToast('Media renamed successfully!', 'success'); fetchGalleryData(); }
          else { showToast('Rename failed', 'error'); }
          return;
        }

        // Booking actions
        if (!target.matches('.admin-action-btn')) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (!id || !action) return;
        let url = ''; let method = 'POST';
        if (action === 'delete') { if (!confirm('Cancel this appointment?')) return; url = `/api/admin/bookings/${id}`; method = 'DELETE'; }
        else if (action === 'complete') { url = `/api/admin/bookings/${id}/complete`; }
        else if (action === 'approve') { url = `/api/admin/queue/${id}/approve`; }
        target.textContent = '…'; target.style.opacity = '0.5';
        try {
          const res = await authFetch(url, { method });
          if (res.ok) {
            showToast(action === 'delete' ? 'Booking cancelled successfully!' : (action === 'complete' ? 'Booking marked as completed!' : 'Queue approved successfully!'), 'success');
            fetchAdminData();
          } else {
            showToast('Action failed', 'error');
            fetchAdminData();
          }
        } catch {
          showToast('Network error', 'error');
          fetchAdminData();
        }
      });

      // Settings timing form submit handler
      const settingsForm = document.getElementById('admin-settings-form');
      if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const wdStart = (document.getElementById('settings-wd-start') as HTMLSelectElement).value;
          const wdEnd = (document.getElementById('settings-wd-end') as HTMLSelectElement).value;
          const satStart = (document.getElementById('settings-sat-start') as HTMLSelectElement).value;
          const satEnd = (document.getElementById('settings-sat-end') as HTMLSelectElement).value;
          const sunStart = (document.getElementById('settings-sun-start') as HTMLSelectElement).value;
          const sunEnd = (document.getElementById('settings-sun-end') as HTMLSelectElement).value;

          try {
            const res = await authFetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                weekday: { start: wdStart, end: wdEnd },
                saturday: { start: satStart, end: satEnd },
                sunday: { start: sunStart, end: sunEnd }
              })
            });
            if (res.ok) {
              showToast('Operating hours updated successfully!', 'success');
              fetchSettingsData();
            } else {
              showToast('Failed to update operating hours.', 'error');
            }
          } catch {
            showToast('Network error while saving settings.', 'error');
          }
        });
      }

      // Settings blocked dates form submit handler
      const blockedForm = document.getElementById('admin-blocked-dates-form');
      if (blockedForm) {
        blockedForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const dateInput = document.getElementById('block-date-input') as HTMLInputElement;
          const date = dateInput.value;
          if (!date) return;

          try {
            const res = await authFetch('/api/settings/blocked-dates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'add', date })
            });
            if (res.ok) {
              showToast(`Blocked appointments for ${date}!`, 'success');
              dateInput.value = '';
              fetchSettingsData();
            } else {
              showToast('Failed to block date.', 'error');
            }
          } catch {
            showToast('Network error.', 'error');
          }
        });
      }

      // Settings unblock button handler (using event delegation on blocked list)
      const blockedListWrap = document.getElementById('blocked-dates-list-wrap');
      if (blockedListWrap) {
        blockedListWrap.addEventListener('click', async (e) => {
          const btn = e.target as HTMLElement;
          if (btn.matches('.unblock-btn')) {
            const date = btn.dataset.date;
            const isBypass = window.location.search.includes('bypass=1');
            if (!date || (!isBypass && !confirm(`Unblock appointments for ${date}?`))) return;
            try {
              const res = await authFetch('/api/settings/blocked-dates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove', date })
              });
              if (res.ok) {
                showToast(`Unblocked appointments for ${date}!`, 'success');
                fetchSettingsData();
              } else {
                showToast('Failed to unblock date.', 'error');
              }
            } catch {
              showToast('Network error.', 'error');
            }
          }
        });
      }

      // Bind logout button click
      const logoutBtn = document.getElementById('admin-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${adminPassword}`
              }
            });
          } catch (e) {
            console.error("Logout request failed:", e);
          }
          sessionStorage.removeItem('adminPassword');
          adminPassword = '';
          window.location.hash = '';
          window.location.reload();
        });
      }

    } else {
      container.style.display = 'block';
      const content = document.getElementById('admin-content');
      if (content) content.innerHTML = 'Loading…';
    }

    await fetchAdminData();
  }

  // ── Settings Data Fetcher & Hours Builder ───────────────────────────────
  async function fetchSettingsData() {
    const wdStart = document.getElementById('settings-wd-start') as HTMLSelectElement;
    const wdEnd = document.getElementById('settings-wd-end') as HTMLSelectElement;
    const satStart = document.getElementById('settings-sat-start') as HTMLSelectElement;
    const satEnd = document.getElementById('settings-sat-end') as HTMLSelectElement;
    const sunStart = document.getElementById('settings-sun-start') as HTMLSelectElement;
    const sunEnd = document.getElementById('settings-sun-end') as HTMLSelectElement;
    
    const blockedList = document.getElementById('blocked-dates-list') as HTMLUListElement;

    if (!wdStart || !wdEnd || !satStart || !satEnd || !sunStart || !sunEnd || !blockedList) return;

    // Fetch hours
    try {
      const res = await fetch('/api/settings');
      const settings = await res.json();
      
      const weekday = settings.weekday || { start: 9, end: 20 };
      const saturday = settings.saturday || { start: 14, end: 20 };
      const sunday = settings.sunday || { start: 9, end: 21 };

      populateTimeOptions(wdStart, weekday.start);
      populateTimeOptions(wdEnd, weekday.end);
      populateTimeOptions(satStart, saturday.start);
      populateTimeOptions(satEnd, saturday.end);
      populateTimeOptions(sunStart, sunday.start);
      populateTimeOptions(sunEnd, sunday.end);
    } catch (err) {
      console.error('Error loading hours settings:', err);
    }

    // Fetch blocked dates
    try {
      const res = await fetch('/api/settings/blocked-dates');
      const dates: string[] = await res.json();
      blockedList.innerHTML = '';
      if (dates.length === 0) {
        blockedList.innerHTML = '<li style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text-secondary);padding:0.5rem 0;">No blocked dates yet.</li>';
      } else {
        dates.forEach(d => {
          const li = document.createElement('li');
          li.style.display = 'flex';
          li.style.justifyContent = 'space-between';
          li.style.alignItems = 'center';
          li.style.padding = '0.5rem 1rem';
          li.style.background = 'rgba(255,255,255,0.4)';
          li.style.border = '1px solid rgba(0,0,0,0.05)';
          li.style.borderRadius = '6px';
          li.style.fontFamily = 'var(--font-mono)';
          li.style.fontSize = '0.85rem';
          li.innerHTML = `
            <span>📅 ${d}</span>
            <button class="unblock-btn hover-target" data-date="${d}" style="background:transparent; border:none; color:red; cursor:pointer; font-weight:bold; font-family:var(--font-mono); text-transform:uppercase;">Remove</button>
          `;
          blockedList.appendChild(li);
        });
      }
    } catch (err) {
      console.error('Error loading blocked dates:', err);
    }
  }

  const populateTimeOptions = (selectEl: HTMLSelectElement, selectedVal: number) => {
    selectEl.innerHTML = '';
    for (let h = 6; h <= 23; h++) {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      const opt = document.createElement('option');
      opt.value = h.toString();
      opt.textContent = `${displayHour}:00 ${period}`;
      if (h === selectedVal) opt.selected = true;
      selectEl.appendChild(opt);
    }
  };

  // ── Analytics Data Fetcher & Chart Builder ──────────────────────────────
  async function fetchAnalyticsData() {
    const analyticsContent = document.getElementById('analytics-content');
    if (!analyticsContent) return;

    analyticsContent.innerHTML = '<div class="spinner"></div><p style="text-align: center; margin-top: 1rem; font-family: var(--font-mono); color: var(--theme-main);">Loading metrics...</p>';

    try {
      const res = await authFetch('/api/admin/bookings');
      const data = await res.json();

      const activeList = data.bookedSlots || [];
      const completedList = data.completedSlots || [];
      const queueList = data.queue || [];

      const totalCompleted = completedList.length;
      const totalActive = activeList.length;
      const totalQueue = queueList.length;

      // Revenue calculations
      const revenueCompleted = completedList.reduce((sum: number, b: any) => sum + getServicePrice(b.service), 0);
      const revenueProjected = activeList.reduce((sum: number, b: any) => sum + getServicePrice(b.service), 0);

      // Barber metrics (Completed bookings) - Case insensitive name matching
      const bobbyCompleted = completedList.filter((b: any) => b.barber && b.barber.toLowerCase().includes('bobby')).length;
      const sumitCompleted = completedList.filter((b: any) => b.barber && b.barber.toLowerCase().includes('sumit')).length;
      const shettyCompleted = completedList.filter((b: any) => b.barber && b.barber.toLowerCase().includes('shetty')).length;
      
      const bobbyRev = completedList.filter((b: any) => b.barber && b.barber.toLowerCase().includes('bobby')).reduce((sum: number, b: any) => sum + getServicePrice(b.service), 0);
      const sumitRev = completedList.filter((b: any) => b.barber && b.barber.toLowerCase().includes('sumit')).reduce((sum: number, b: any) => sum + getServicePrice(b.service), 0);
      const shettyRev = completedList.filter((b: any) => b.barber && b.barber.toLowerCase().includes('shetty')).reduce((sum: number, b: any) => sum + getServicePrice(b.service), 0);

      // Gender Breakdown (Completed + Active)
      const totalBookings = completedList.concat(activeList);
      const maleCount = totalBookings.filter((b: any) => b.gender === 'Male').length;
      const femaleCount = totalBookings.filter((b: any) => b.gender === 'Female').length;
      const genderTotal = maleCount + femaleCount || 1;
      const malePct = Math.round((maleCount / genderTotal) * 100);
      const femalePct = Math.round((femaleCount / genderTotal) * 100);

      // Service popularity (Top 4 completed services)
      const serviceCounts: { [key: string]: number } = {};
      completedList.forEach((b: any) => {
        const key = b.service || 'Unknown';
        serviceCounts[key] = (serviceCounts[key] || 0) + 1;
      });
      const topServices = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      // Calculate 7-day bookings trend dates & counts
      const dayLabels: string[] = [];
      const dayCounts: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const dateStr = formatter.format(d);
        
        const labelFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          month: 'short',
          day: 'numeric'
        });
        dayLabels.push(labelFormatter.format(d));
        
        const count = totalBookings.filter((b: any) => b.date === dateStr).length;
        dayCounts.push(count);
      }

      // Generate Line Graph SVG coordinates
      const maxCountVal = Math.max(...dayCounts, 5);
      const points = dayCounts.map((count, index) => {
        const x = 40 + index * 65;
        const y = 80 - (count / maxCountVal) * 60;
        return { x, y, count };
      });
      const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;

      const lineGraphSvg = `
        <svg width="100%" height="180" viewBox="0 0 500 110" style="display: block; overflow: visible;">
          <!-- Grid Lines -->
          <line x1="40" y1="20" x2="430" y2="20" stroke="rgba(0,0,0,0.04)" stroke-dasharray="3 3"></line>
          <line x1="40" y1="50" x2="430" y2="50" stroke="rgba(0,0,0,0.04)" stroke-dasharray="3 3"></line>
          <line x1="40" y1="80" x2="430" y2="80" stroke="rgba(0,0,0,0.06)"></line>
          
          <!-- Y-Axis labels -->
          <text x="30" y="23" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)" text-anchor="end">${maxCountVal}</text>
          <text x="30" y="53" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)" text-anchor="end">${Math.round(maxCountVal / 2)}</text>
          <text x="30" y="83" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)" text-anchor="end">0</text>
          
          <!-- Trend Line Path -->
          <path d="${pathD}" fill="none" stroke="var(--theme-main)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 3px 6px rgba(51,75,51,0.15));"></path>
          
          <!-- Dots and Values -->
          ${points.map((p, index) => `
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="#ffffff" stroke="var(--theme-main)" stroke-width="2.5" class="hover-target" style="cursor: pointer;"></circle>
            <text x="${p.x}" y="${p.y - 8}" font-family="var(--font-mono)" font-size="7" font-weight="bold" fill="var(--theme-main)" text-anchor="middle">${p.count}</text>
            <text x="${p.x}" y="95" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)" text-anchor="middle">${dayLabels[index]}</text>
          `).join('')}
        </svg>
      `;

      // Barber revenue donut calculations
      const totalRev = bobbyRev + sumitRev + shettyRev || 1;
      const bobbyPct = Math.round((bobbyRev / totalRev) * 100);
      const sumitPct = Math.round((sumitRev / totalRev) * 100);
      const shettyPct = Math.round((shettyRev / totalRev) * 100);

      const radius = 35;
      const circumference = 2 * Math.PI * radius; // ~219.9
      
      const bobbyStroke = (bobbyRev / totalRev) * circumference;
      const sumitStroke = (sumitRev / totalRev) * circumference;
      const shettyStroke = (shettyRev / totalRev) * circumference;

      const bobbyOffset = circumference;
      const sumitOffset = circumference - bobbyStroke;
      const shettyOffset = circumference - bobbyStroke - sumitStroke;

      const donutSvg = `
        <svg width="100%" height="160" viewBox="0 0 160 100" style="display: block; margin: auto; overflow: visible;">
          <!-- Background circle -->
          <circle cx="50" cy="50" r="35" fill="transparent" stroke="rgba(0,0,0,0.03)" stroke-width="12"></circle>
          
          <!-- Bobby segment -->
          <circle cx="50" cy="50" r="35" fill="transparent" stroke="var(--theme-main)" stroke-width="12"
            stroke-dasharray="${bobbyStroke} ${circumference - bobbyStroke}"
            stroke-dashoffset="${bobbyOffset}"
            transform="rotate(-90 50 50)"></circle>
            
          <!-- Sumit segment -->
          <circle cx="50" cy="50" r="35" fill="transparent" stroke="#8FBC8F" stroke-width="12"
            stroke-dasharray="${sumitStroke} ${circumference - sumitStroke}"
            stroke-dashoffset="${sumitOffset}"
            transform="rotate(-90 50 50)"></circle>

          <!-- Shetty segment -->
          <circle cx="50" cy="50" r="35" fill="transparent" stroke="#FF8C00" stroke-width="12"
            stroke-dasharray="${shettyStroke} ${circumference - shettyStroke}"
            stroke-dashoffset="${shettyOffset}"
            transform="rotate(-90 50 50)"></circle>
            
          <!-- Center label -->
          <text x="50" y="53" text-anchor="middle" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)" font-weight="bold">REVENUE</text>
          
          <!-- Legends -->
          <g transform="translate(100, 25)">
            <circle cx="0" cy="0" r="3.5" fill="var(--theme-main)"></circle>
            <text x="8" y="2.5" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)">Bobby (${bobbyPct}%)</text>
            
            <circle cx="0" cy="15" r="3.5" fill="#8FBC8F"></circle>
            <text x="8" y="17.5" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)">Sumit (${sumitPct}%)</text>

            <circle cx="0" cy="30" r="3.5" fill="#FF8C00"></circle>
            <text x="8" y="32.5" font-family="var(--font-mono)" font-size="7" fill="var(--text-secondary)">Shetty (${shettyPct}%)</text>
          </g>
        </svg>
      `;

      // Render Dashboard Analytics UI
      const html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          <div class="admin-glass-panel" style="text-align: center; padding: 2rem;">
            <h4 style="font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem;">Completed Revenue</h4>
            <p style="font-family: var(--font-serif); font-size: 2.5rem; color: #2E8B57; font-weight: 500; margin: 0;">INR ${revenueCompleted}</p>
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono);">${totalCompleted} bookings</span>
          </div>
          <div class="admin-glass-panel" style="text-align: center; padding: 2rem;">
            <h4 style="font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem;">Projected Revenue</h4>
            <p style="font-family: var(--font-serif); font-size: 2.5rem; color: #FF8C00; font-weight: 500; margin: 0;">INR ${revenueProjected}</p>
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono);">${totalActive} active bookings</span>
          </div>
          <div class="admin-glass-panel" style="text-align: center; padding: 2rem;">
            <h4 style="font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem;">Queue Waitlist</h4>
            <p style="font-family: var(--font-serif); font-size: 2.5rem; color: #4682B4; font-weight: 500; margin: 0;">${totalQueue}</p>
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono);">in queue</span>
          </div>
        </div>

        <!-- Weekly Bookings Trend SVG card -->
        <div class="admin-glass-panel" style="margin-bottom: 2rem; overflow: visible;">
          <h3 style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--theme-main); margin-bottom: 2rem;">7-Day Bookings Trend</h3>
          <div style="width: 100%; overflow-x: auto; padding: 1rem 0;">
            <div style="min-width: 500px;">
              ${lineGraphSvg}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
          <!-- Barber Performance & Donut Chart -->
          <div class="admin-glass-panel" style="padding: 2rem;">
            <h3 style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--theme-main); margin-bottom: 2rem;">Barber Performance</h3>
            
            <div style="margin-bottom: 2.5rem;">
              ${donutSvg}
            </div>

            <div style="display:flex; flex-direction:column; gap: 1.25rem;">
              <!-- Bobby -->
              <div>
                <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem; margin-bottom:0.4rem;">
                  <span>Bobby</span>
                  <strong>INR ${bobbyRev} (${bobbyCompleted} jobs)</strong>
                </div>
                <div style="background:rgba(0,0,0,0.05); height:10px; border-radius:10px; overflow:hidden;">
                  <div style="background:var(--theme-main); width:${revenueCompleted > 0 ? (bobbyRev / revenueCompleted) * 100 : 0}%; height:100%; border-radius:10px; transition: width 1s ease-out;"></div>
                </div>
              </div>
              <!-- Sumit -->
              <div>
                <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem; margin-bottom:0.4rem;">
                  <span>Sumit</span>
                  <strong>INR ${sumitRev} (${sumitCompleted} jobs)</strong>
                </div>
                <div style="background:rgba(0,0,0,0.05); height:10px; border-radius:10px; overflow:hidden;">
                  <div style="background:#8FBC8F; width:${revenueCompleted > 0 ? (sumitRev / revenueCompleted) * 100 : 0}%; height:100%; border-radius:10px; transition: width 1s ease-out;"></div>
                </div>
              </div>
              <!-- Shetty -->
              <div>
                <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem; margin-bottom:0.4rem;">
                  <span>Shetty Bhai</span>
                  <strong>INR ${shettyRev} (${shettyCompleted} jobs)</strong>
                </div>
                <div style="background:rgba(0,0,0,0.05); height:10px; border-radius:10px; overflow:hidden;">
                  <div style="background:#FF8C00; width:${revenueCompleted > 0 ? (shettyRev / revenueCompleted) * 100 : 0}%; height:100%; border-radius:10px; transition: width 1s ease-out;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Service Gender Share -->
          <div class="admin-glass-panel" style="padding: 2rem;">
            <h3 style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--theme-main); margin-bottom: 1.5rem;">Gender Booking Share</h3>
            <div style="display:flex; flex-direction:column; gap: 1.5rem; justify-content:center; align-items:center; min-height: 180px;">
              <div style="width: 100%;">
                <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem; margin-bottom:0.4rem;">
                  <span>Male Customers</span>
                  <strong>${malePct}%</strong>
                </div>
                <div style="background:rgba(0,0,0,0.05); height:10px; border-radius:10px; overflow:hidden; margin-bottom: 1.5rem;">
                  <div style="background:#4682B4; width:${malePct}%; height:100%; border-radius:10px; transition: width 1s ease-out;"></div>
                </div>
                
                <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem; margin-bottom:0.4rem;">
                  <span>Female Customers</span>
                  <strong>${femalePct}%</strong>
                </div>
                <div style="background:rgba(0,0,0,0.05); height:10px; border-radius:10px; overflow:hidden;">
                  <div style="background:#FF69B4; width:${femalePct}%; height:100%; border-radius:10px; transition: width 1s ease-out;"></div>
                </div>
              </div>
              
              <div style="width:100%; height:16px; display:flex; border-radius:8px; overflow:hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1); margin-top: 1rem;">
                <div style="width:${malePct}%; background:#4682B4;" title="Male"></div>
                <div style="width:${femalePct}%; background:#FF69B4;" title="Female"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-glass-panel" style="margin-top: 2rem;">
          <h3 style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--theme-main); margin-bottom: 1.5rem;">Most Popular Services</h3>
          <div style="display:flex; flex-direction:column; gap:1.2rem;">
            ${topServices.length === 0 ? '<p style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-secondary);">No completed bookings data yet.</p>' : topServices.map(([srv, count], index) => {
              const maxCount = topServices[0][1] || 1;
              const barWidth = (count / maxCount) * 100;
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-family:var(--font-mono); font-size:0.85rem; margin-bottom:0.3rem;">
                    <span>#${index + 1} ${srv}</span>
                    <strong>${count} booking${count !== 1 ? 's' : ''}</strong>
                  </div>
                  <div style="background:rgba(0,0,0,0.05); height:8px; border-radius:10px; overflow:hidden;">
                    <div style="background:var(--theme-main); width:${barWidth}%; height:100%; border-radius:10px; transition: width 1s ease-out;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      analyticsContent.innerHTML = html;
    } catch {
      analyticsContent.innerHTML = '<p style="color:red; font-family:var(--font-mono);">Failed to fetch analytics metrics.</p>';
    }
  }

  // ── Gallery Data Fetcher ─────────────────────────────────────────────────
  async function fetchGalleryData() {
    const grid = document.getElementById('gallery-grid');
    const countEl = document.getElementById('gallery-count');
    if (!grid) return;
    grid.innerHTML = '<div class="spinner" style="grid-column:1/-1;margin:2rem auto;"></div>';

    try {
      const res = await fetch('/api/gallery');
      const files: any[] = await res.json();

      if (countEl) countEl.textContent = `${files.length} item${files.length !== 1 ? 's' : ''}`;

      if (files.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-family:var(--font-mono); color:var(--text-secondary); padding: 3rem;">No files yet — upload some above!</p>';
        return;
      }

      // Store current order in memory
      const currentOrder = [...files];

      const saveOrder = async () => {
        await authFetch('/api/admin/gallery/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: currentOrder })
        });
      };

      // Helper to safely encode values for HTML data attributes
      const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const renderGrid = () => {
        grid.innerHTML = currentOrder.map((item: any, index: number) => {
          const file = item.filename || 'Untitled';
          const src = item.url || '';
          const publicId = item.public_id || '';
          const safePublicId = escAttr(publicId);
          const safeFile = escAttr(file);
          const safeSrc = escAttr(src);
          const isVideo = item.resource_type === 'video' || ['mp4', 'webm'].includes((file.split('.').pop() || '').toLowerCase());

          const preview = isVideo
            ? `<video src="${safeSrc}" style="width:100%;height:160px;object-fit:cover;display:block;border-radius:12px 12px 0 0;" muted preload="metadata"></video>`
            : `<img src="${safeSrc}" alt="${safeFile}" style="width:100%;height:160px;object-fit:cover;display:block;border-radius:12px 12px 0 0;" loading="lazy" onerror="this.style.background='#eee';this.alt='Failed to load';" />`;

          const badge = isVideo
            ? `<span style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-family:var(--font-mono);font-size:0.6rem;padding:3px 8px;border-radius:20px;letter-spacing:0.1em;">▶ VIDEO</span>`
            : `<span style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-family:var(--font-mono);font-size:0.6rem;padding:3px 8px;border-radius:20px;letter-spacing:0.1em;">🖼 IMAGE</span>`;

          // Position number badge (top-right)
          const posBadge = `<span style="position:absolute;top:8px;right:8px;background:var(--theme-main);color:#fff;font-family:var(--font-mono);font-size:0.65rem;padding:3px 8px;border-radius:20px;letter-spacing:0.05em;font-weight:600;">#${index + 1}</span>`;

          return `
            <div class="gallery-card" draggable="true" data-file="${safePublicId}" data-index="${index}"
              style="border-radius:12px;overflow:hidden;background:white;box-shadow:0 2px 12px rgba(0,0,0,0.08);transition:transform 0.2s,box-shadow 0.2s,opacity 0.2s;position:relative;cursor:grab;">
              ${preview}
              ${badge}
              ${posBadge}
              <div style="padding:0.75rem;">
                <p style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.5rem;" title="${safeFile}">${safeFile}</p>
                <div style="display:flex;gap:0.4rem;margin-bottom:0.5rem;">
                  <button class="gallery-move-btn" data-file="${safePublicId}" data-dir="left" title="Move left"
                    style="flex:0 0 auto;width:32px;font-size:0.85rem;padding:0.3rem;border:1px solid rgba(0,0,0,0.15);background:transparent;border-radius:6px;cursor:none;transition:all 0.2s;"
                    ${index === 0 ? 'disabled style="opacity:0.3;pointer-events:none;flex:0 0 auto;width:32px;font-size:0.85rem;padding:0.3rem;border:1px solid rgba(0,0,0,0.15);background:transparent;border-radius:6px;cursor:none;"' : ''}>◀</button>
                  <button class="gallery-move-btn" data-file="${safePublicId}" data-dir="right" title="Move right"
                    style="flex:0 0 auto;width:32px;font-size:0.85rem;padding:0.3rem;border:1px solid rgba(0,0,0,0.15);background:transparent;border-radius:6px;cursor:none;transition:all 0.2s;"
                    ${index === currentOrder.length - 1 ? 'disabled style="opacity:0.3;pointer-events:none;flex:0 0 auto;width:32px;font-size:0.85rem;padding:0.3rem;border:1px solid rgba(0,0,0,0.15);background:transparent;border-radius:6px;cursor:none;"' : ''}>▶</button>
                  <button class="gallery-rename-btn" data-file="${safeFile}" data-publicid="${safePublicId}" style="flex:1;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.1em;padding:0.3rem;border:1px solid var(--theme-main);background:transparent;color:var(--theme-main);border-radius:6px;cursor:none;transition:all 0.2s;">RENAME</button>
                  <button class="gallery-delete-btn" data-file="${safeFile}" data-publicid="${safePublicId}" style="flex:1;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.1em;padding:0.3rem;border:1px solid #dc3545;background:transparent;color:#dc3545;border-radius:6px;cursor:none;transition:all 0.2s;">DELETE</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // ── Drag-and-drop handlers ─────────
        let draggedFile: string | null = null;

        grid.querySelectorAll('.gallery-card').forEach(card => {
          const el = card as HTMLElement;

          el.addEventListener('dragstart', (e: Event) => {
            const de = e as DragEvent;
            draggedFile = el.dataset.file || null;
            el.style.opacity = '0.4';
            de.dataTransfer!.effectAllowed = 'move';
            // Store index for reorder
            de.dataTransfer!.setData('text/plain', el.dataset.index || '');
          });

          el.addEventListener('dragend', () => {
            el.style.opacity = '1';
            draggedFile = null;
            // Remove all drag-over hints
            grid.querySelectorAll('.gallery-card').forEach(c => {
              (c as HTMLElement).style.borderLeft = '';
              (c as HTMLElement).style.borderRight = '';
            });
          });

          el.addEventListener('dragover', (e: Event) => {
            e.preventDefault();
            (e as DragEvent).dataTransfer!.dropEffect = 'move';
            const targetFile = el.dataset.file;
            if (targetFile && targetFile !== draggedFile) {
              // Show visual hint
              const rect = el.getBoundingClientRect();
              const midX = rect.left + rect.width / 2;
              const mouseX = (e as DragEvent).clientX;
              grid.querySelectorAll('.gallery-card').forEach(c => {
                (c as HTMLElement).style.borderLeft = '';
                (c as HTMLElement).style.borderRight = '';
              });
              if (mouseX < midX) {
                el.style.borderLeft = '3px solid var(--theme-main)';
              } else {
                el.style.borderRight = '3px solid var(--theme-main)';
              }
            }
          });

          el.addEventListener('dragleave', () => {
            el.style.borderLeft = '';
            el.style.borderRight = '';
          });

          el.addEventListener('drop', (e: Event) => {
            e.preventDefault();
            const targetPublicId = el.dataset.file;
            if (!draggedFile || !targetPublicId || draggedFile === targetPublicId) return;

            const fromIdx = currentOrder.findIndex((item: any) => item.public_id === draggedFile);
            const toIdx = currentOrder.findIndex((item: any) => item.public_id === targetPublicId);
            if (fromIdx === -1 || toIdx === -1) return;

            // Determine if drop is before or after target
            const rect = el.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            const mouseX = (e as DragEvent).clientX;

            // Remove from old position
            const [draggedItem] = currentOrder.splice(fromIdx, 1);
            // Insert at new position
            let insertIdx = currentOrder.findIndex((item: any) => item.public_id === targetPublicId);
            if (mouseX >= midX) insertIdx += 1;
            currentOrder.splice(insertIdx, 0, draggedItem);

            el.style.borderLeft = '';
            el.style.borderRight = '';

            renderGrid();
            saveOrder();
          });
        });

        // ── Move button handlers ─────────
        grid.querySelectorAll('.gallery-move-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const publicId = (btn as HTMLElement).dataset.file!;
            const dir = (btn as HTMLElement).dataset.dir!;
            const idx = currentOrder.findIndex((item: any) => item.public_id === publicId);
            if (idx === -1) return;

            if (dir === 'left' && idx > 0) {
              [currentOrder[idx - 1], currentOrder[idx]] = [currentOrder[idx], currentOrder[idx - 1]];
            } else if (dir === 'right' && idx < currentOrder.length - 1) {
              [currentOrder[idx], currentOrder[idx + 1]] = [currentOrder[idx + 1], currentOrder[idx]];
            } else return;

            renderGrid();
            saveOrder();
          });
        });
      };

      renderGrid();
    } catch (err) {
      console.error('Gallery render error:', err);
      if (grid) grid.innerHTML = '<p style="color:red;font-family:var(--font-mono);grid-column:1/-1;">Error loading gallery</p>';
    }
  }



  // Hero Video Fallback Logic
  const localVideo = document.getElementById('hero-local-video') as HTMLVideoElement;
  const youtubeFallback = document.getElementById('hero-youtube') as HTMLIFrameElement;
  if (localVideo && youtubeFallback) {
    function fallbackToYoutube() {
      if (localVideo) localVideo.style.display = 'none';
      const fallbackSrc = youtubeFallback.dataset.src;
      if (fallbackSrc) {
        youtubeFallback.src = fallbackSrc;
      }
      youtubeFallback.style.display = 'block';
    }
    localVideo.addEventListener('error', fallbackToYoutube);
  }

  // Dynamic Infinite Gallery Slider — Performance-Optimized
  const sliderTrack = document.getElementById('portfolio-slider-track');
  if (sliderTrack) {
    fetch('/api/gallery')
      .then(res => res.json())
      .then((items: any[]) => {
        if (items && items.length > 0) {
          const generateItemsHTML = () => {
            return items.map((item: any) => {
              const src = item.url;
              const isVideo = item.resource_type === 'video' || ['mp4', 'webm'].includes((item.filename || '').split('.').pop()?.toLowerCase() || '');
              const content = isVideo 
                ? `<video data-src="${src}" loop muted playsinline preload="none" poster="" style="background:#e8e8e0;"></video>`
                : `<img src="${src}" alt="Bobby Salon Work" loading="lazy" />`;
              
              return `<div class="infinite-slider-item">${content}</div>`;
            }).join('');
          };
          
          const itemsHTML = generateItemsHTML();
          sliderTrack.innerHTML = itemsHTML + itemsHTML;

          const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              const video = entry.target as HTMLVideoElement;
              if (entry.isIntersecting) {
                if (!video.src && video.dataset.src) {
                  video.src = video.dataset.src;
                  video.load();
                }
                video.play().catch(() => {});
              } else {
                if (video.src) video.pause();
              }
            });
          }, { rootMargin: '200px' });

          sliderTrack.querySelectorAll('video[data-src]').forEach(v => {
            videoObserver.observe(v);
          });
        }
      })
      .catch(err => console.error("Error loading gallery:", err));
  }

  // Services Admin CRUD Data Fetcher
  async function fetchAdminServicesData() {
    const tableBody = document.getElementById('admin-services-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<div style="grid-column: 1/-1; padding: 3rem; text-align: center; font-family: var(--font-mono); color: var(--theme-main);"><div class="spinner"></div>Loading services...</div>';

    try {
      // Use admin endpoint to get ALL services (incl. hidden ones)
      const res = await authFetch('/api/admin/services');
      servicesList = await res.json();
      
      tableBody.innerHTML = '';
      if (servicesList.length === 0) {
        tableBody.innerHTML = '<div style="grid-column: 1/-1; padding: 3rem; text-align: center; font-family: var(--font-mono); color: var(--text-secondary);">No services configured yet.</div>';
        return;
      }

      servicesList.forEach((s: any) => {
        const isVisible = s.visible !== false;
        const card = document.createElement('div');
        card.className = 'admin-service-card hover-target';
        if (!isVisible) {
          card.style.opacity = '0.65';
        }
        
        card.innerHTML = `
          <div class="admin-service-header">
            <h3 class="admin-service-name">${escapeHtml(s.name)}</h3>
            <span class="admin-badge" style="
              background: ${isVisible ? 'rgba(40,160,70,0.12)' : 'rgba(180,0,0,0.1)'};
              color: ${isVisible ? '#2e8b57' : '#d32f2f'};
              border: 1px solid ${isVisible ? 'rgba(40,160,70,0.2)' : 'rgba(180,0,0,0.15)'};
            ">
              ${isVisible ? '● Active' : '○ Hidden'}
            </span>
          </div>
          
          <div class="admin-service-meta">
            <span class="admin-service-meta-item">Gender: ${escapeHtml(s.gender)}</span>
            <span class="admin-service-meta-item">Duration: ${escapeHtml(s.duration)} mins</span>
            <span class="admin-service-meta-item">Price: INR ${escapeHtml(s.price.toString())}</span>
          </div>
          
          <div class="admin-service-actions">
            <button class="admin-toggle-visibility-btn admin-btn admin-btn-sm hover-target"
              data-id="${escapeHtml(s._id)}"
              data-visible="${isVisible ? 'true' : 'false'}"
              title="${isVisible ? 'Hide from website' : 'Show on website'}"
              style="flex: 1; justify-content: center; font-family: var(--font-mono); ${isVisible ? 'background: rgba(211,47,47,0.1); color: #d32f2f; border: 1px solid rgba(211,47,47,0.2);' : 'background: rgba(46,139,87,0.1); color: #2e8b57; border: 1px solid rgba(46,139,87,0.2);'}">
              ${isVisible ? '🙈 Hide' : '👁 Show'}
            </button>
            <button class="admin-edit-service-btn admin-btn admin-btn-sm admin-btn-primary hover-target" 
              data-id="${escapeHtml(s._id)}" 
              style="flex: 1; justify-content: center; font-family: var(--font-mono);">
              Edit
            </button>
            <button class="admin-delete-service-btn admin-btn admin-btn-sm admin-btn-danger hover-target" 
              data-id="${escapeHtml(s._id)}" 
              style="flex: 1; justify-content: center; font-family: var(--font-mono);">
              Delete
            </button>
          </div>
        `;
        tableBody.appendChild(card);
      });
      
      // Global event delegation on document already handles cursor hover for all dynamic elements.
    } catch {
      tableBody.innerHTML = '<div style="grid-column: 1/-1; padding: 3rem; text-align: center; color: red;">Error loading services.</div>';
    }
  }

  // Listen for Services Action Clicks
  document.body.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;

    // Visibility toggle
    if (target.matches('.admin-toggle-visibility-btn')) {
      const id = target.dataset.id!;
      const currentlyVisible = target.dataset.visible === 'true';
      const newVisible = !currentlyVisible;
      target.textContent = '…';
      (target as HTMLButtonElement).disabled = true;
      try {
        const res = await authFetch(`/api/admin/services/${id}/visibility`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visible: newVisible })
        });
        if (res.ok) {
          showToast('Service visibility updated!', 'success');
          await fetchServices();
          fetchAdminServicesData();
        } else {
          showToast('Failed to update visibility.', 'error');
          (target as HTMLButtonElement).disabled = false;
          target.textContent = currentlyVisible ? '🙈 Hide' : '👁 Show';
        }
      } catch {
        showToast('Network error.', 'error');
        (target as HTMLButtonElement).disabled = false;
      }
      return;
    }

    if (target.matches('.admin-delete-service-btn')) {
      const id = target.dataset.id!;
      if (!confirm('Delete this service?')) return;
      target.textContent = '…';
      target.style.opacity = '0.5';
      const res = await authFetch(`/api/admin/services/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Service deleted successfully!', 'success');
        await fetchServices();
        fetchAdminServicesData();
      } else {
        showToast('Delete failed', 'error');
        target.textContent = 'Delete';
        target.style.opacity = '1';
      }
      return;
    }

    if (target.matches('.admin-edit-service-btn')) {
      const id = target.dataset.id!;
      const s = servicesList.find(item => item._id === id);
      if (!s) return;

      const formWrap = document.getElementById('admin-service-form-wrap')!;
      const formTitle = document.getElementById('admin-service-form-title')!;
      const asId = document.getElementById('as-id') as HTMLInputElement;
      const asName = document.getElementById('as-name') as HTMLInputElement;
      const asGender = document.getElementById('as-gender') as HTMLSelectElement;
      const asDuration = document.getElementById('as-duration') as HTMLInputElement;
      const asPrice = document.getElementById('as-price') as HTMLInputElement;

      asId.value = s._id;
      asName.value = s.name;
      asGender.value = s.gender;
      asDuration.value = s.duration.toString();
      asPrice.value = s.price.toString();

      formTitle.textContent = 'Edit Service';
      formWrap.classList.add('active');
      return;
    }
  });

  // Service Form Handler Init
  const handleServiceFormInit = () => {
    const addBtn = document.getElementById('admin-add-service-btn');
    const cancelBtn = document.getElementById('admin-service-form-cancel-btn');
    const closeBtn = document.getElementById('admin-service-form-close-btn');
    const formWrap = document.getElementById('admin-service-form-wrap');
    const form = document.getElementById('admin-service-form') as HTMLFormElement;
    const formTitle = document.getElementById('admin-service-form-title');
    const asId = document.getElementById('as-id') as HTMLInputElement;

    if (addBtn && formWrap && form) {
      addBtn.addEventListener('click', () => {
        form.reset();
        asId.value = '';
        if (formTitle) formTitle.textContent = 'Add New Service';
        formWrap.classList.add('active');
      });

      const hideModal = () => {
        formWrap.classList.remove('active');
      };

      cancelBtn?.addEventListener('click', hideModal);
      closeBtn?.addEventListener('click', hideModal);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = asId.value;
        const name = (document.getElementById('as-name') as HTMLInputElement).value;
        const gender = (document.getElementById('as-gender') as HTMLSelectElement).value;
        const duration = (document.getElementById('as-duration') as HTMLInputElement).value;
        const price = (document.getElementById('as-price') as HTMLInputElement).value;

        const url = id ? `/api/admin/services/${id}` : '/api/admin/services';
        const method = id ? 'PUT' : 'POST';

        try {
          const res = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, gender, duration, price })
          });

          if (res.ok) {
            showToast(id ? 'Service updated successfully!' : 'Service created successfully!', 'success');
            hideModal();
            form.reset();
            await fetchServices();
            fetchAdminServicesData();
          } else {
            showToast('Failed to save service.', 'error');
          }
        } catch {
          showToast('Network error while saving service.', 'error');
        }
      });
    }
  };

  // Search/Filter catalog listeners
  const searchInputCatalog = document.getElementById('catalog-search') as HTMLInputElement;
  searchInputCatalog?.addEventListener('input', renderServicesCatalog);

  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderServicesCatalog();
    });
  });

  // Reset filters to ALL and search input to empty on page load
  if (searchInputCatalog) {
    searchInputCatalog.value = '';
  }
  const allTab = document.querySelector('.filter-tab[data-filter="all"]');
  if (allTab) {
    filterTabs.forEach(t => t.classList.remove('active'));
    allTab.classList.add('active');
  }

  // Service Worker Registration for PWA
  if ('serviceWorker' in navigator) {
    const hasController = !!navigator.serviceWorker.controller;
    let refreshing = false;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('✅ ServiceWorker registered with scope: ', reg.scope);

        // Force check for updates on load
        reg.update();

        // Check for updates when user returns to the page
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update();
          }
        });

        // Check for updates periodically or on page interaction
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✨ New Service Worker version available.');
              }
            });
          }
        });
      }).catch(err => {
        console.error('❌ ServiceWorker registration failed: ', err);
      });
    });

    // Reload the page when a new service worker takes control (only if we already had a controller)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasController && !refreshing) {
        refreshing = true;
        console.log('🔄 New Service Worker version activated. Reloading page...');
        window.location.reload();
      }
    });
  }

  // PWA Install Prompt Banner
  let deferredPrompt: any = null;
  const pwaBanner = document.createElement('div');
  pwaBanner.className = 'pwa-install-banner';
  pwaBanner.innerHTML = `
    <img src="/logo.png" alt="Bobby Salon Logo" class="pwa-logo" />
    <div class="pwa-info">
      <h4>Bobby Salon App</h4>
      <p>Install on your home screen for quick offline bookings.</p>
    </div>
    <div class="pwa-buttons">
      <button class="pwa-btn dismiss hover-target">LATER</button>
      <button class="pwa-btn install hover-target">INSTALL</button>
    </div>
  `;
  document.body.appendChild(pwaBanner);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
      pwaBanner.style.display = 'flex';
      // Global event delegation on document already handles cursor hover for all dynamic elements.
    }, 3000);
  });

  pwaBanner.querySelector('.pwa-btn.install')?.addEventListener('click', () => {
    pwaBanner.style.display = 'none';
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted PWA install prompt');
        }
        deferredPrompt = null;
      });
    }
  });

  pwaBanner.querySelector('.pwa-btn.dismiss')?.addEventListener('click', () => {
    pwaBanner.style.display = 'none';
  });

  // Initializations
  fetchServices();
  handleServiceFormInit();

});
