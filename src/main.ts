import './index.css';

document.addEventListener('DOMContentLoaded', () => {
  // Custom Cursor Logic — GPU-optimized
  const cursor = document.querySelector('.custom-cursor') as HTMLDivElement;

  if (cursor) {
    let cursorX = 0, cursorY = 0;
    let rafId = 0;

    const updateCursor = () => {
      cursor.style.transform = `translate3d(${cursorX - 6}px, ${cursorY - 6}px, 0)`;
      rafId = 0;
    };

    document.addEventListener('mousemove', (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      if (!rafId) rafId = requestAnimationFrame(updateCursor);
    }, { passive: true });

    // Use event delegation instead of attaching to every element
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.hover-target, a, button, input, select')) {
        cursor.classList.add('hover');
      }
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.hover-target, a, button, input, select')) {
        cursor.classList.remove('hover');
      }
    }, { passive: true });
  }

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

  const maleServices = [
    "Haircut + Beard (40 Min)",
    "Only Haircut (25 Min)",
    "Only Beard (15 Min)",
    "Clean Shave (15 Min)",
    "Face Massage (30 Min)",
    "Face Cleanup (30 Min)",
    "Facial (1 Hour)",
    "Hydra Facial (1 Hour)",
    "Hair Color (45 Min)",
    "Haircut + Hair Color (1 Hour)"
  ];

  const femaleServices = [
    "Haircut (1 Hour)",
    "Hair Wash (30 Min)",
    "Hair Wash + Blow Dry (45 Min)",
    "Hair Color (1 Hour 20 Min)",
    "Hair Color Touch Up (1 Hour)",
    "Face Cleanup (30 Min)",
    "Facial (1 Hour)",
    "Hair Treatment (4 Hour)",
    "Hair Spa (1 Hour)"
  ];

  if (genderInput && serviceInput && barberInput) {
    genderInput.addEventListener('change', (e) => {
      const gender = (e.target as HTMLSelectElement).value;
      serviceInput.innerHTML = '<option value="" disabled selected>Select Service</option>';
      serviceInput.disabled = false;
      
      let services: string[] = [];
      if (gender === 'Male') {
        services = maleServices;
        barberInput.innerHTML = `
          <option value="" disabled selected>Preferred Barber</option>
          <option value="Any Available">Any Available</option>
          <option value="Bobby">Bobby</option>
          <option value="Sumit">Sumit</option>
        `;
      } else if (gender === 'Female') {
        services = femaleServices;
        barberInput.innerHTML = `
          <option value="Sumit" selected>Sumit (Specialist)</option>
        `;
      }

      services.forEach(service => {
        const option = document.createElement('option');
        option.value = service;
        option.textContent = service;
        serviceInput.appendChild(option);
      });
      
      if (typeof (window as any).renderSlots === 'function') {
        (window as any).renderSlots();
      }
    });
  }

  // Set today's date as default
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  let currentSlotsData: any[] = [];

  const renderSlots = () => {
    if (!timeSlotGrid) return;
    timeSlotGrid.innerHTML = '';
    const gender = genderInput ? genderInput.value : '';

    currentSlotsData.forEach((slot: any, index: number) => {
      let isTaken = slot.taken;
      if (gender === 'Female' && slot.availableForFemale === false) {
        isTaken = true;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `slot-btn hover-target ${isTaken ? 'taken' : ''}`;
      btn.style.animationDelay = `${index * 40}ms`;
      
      if (isTaken) {
        btn.innerHTML = `${slot.time}<span style="display:block;font-size:0.65rem;letter-spacing:0.15em;color:rgba(180,0,0,0.5);margin-top:2px;">BOOKED</span>`;
      } else {
        btn.textContent = slot.time;
      }
      
      btn.addEventListener('click', () => {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active', 'queue-active'));
        
        if (isTaken) {
          const joinQueue = confirm(`The ${slot.time} slot is currently taken. Would you like to join the waitlist queue for this time?`);
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
      });
      
      timeSlotGrid.appendChild(btn);
    });
  };


  (window as any).renderSlots = renderSlots;

  const fetchSlots = async (date: string) => {
    if (!timeSlotGrid) return;
    timeSlotGrid.innerHTML = '<p style="grid-column: 1/-1; color: var(--theme-main); font-family: var(--font-mono);">Loading slots...</p>';
    
    try {
      // Connect to the local Express backend via Vite proxy
      const response = await fetch(`/api/slots?date=${date}`);
      const data = await response.json();
      currentSlotsData = data.slots;
      renderSlots();
    } catch (error) {
      timeSlotGrid.innerHTML = '<p style="grid-column: 1/-1; color: red;">Failed to load slots. Is the backend running?</p>';
    }
  };

  // Fetch slots when date changes
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      fetchSlots((e.target as HTMLInputElement).value);
    });
    // Initial fetch
    fetchSlots(dateInput.value);
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!timeInput.value) {
        alert('Please select a time slot or join a waitlist queue before submitting.');
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
          alert(errorData.error || 'Failed to book slot');
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
              <h2>Booking Locked!</h2>
              <p style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 1rem;">Please complete your booking by confirming via WhatsApp.</p>
              <p style="font-size: 1.0rem; color: var(--theme-main); font-family: var(--font-mono); margin-bottom: 2rem; padding: 1rem; border: 1px solid var(--theme-main); border-radius: 8px;">⏳ Note: Please arrive at the salon 10-15 minutes before your appointment time (${time}).</p>
              <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button id="add-to-calendar-btn" class="hover-target" style="background: transparent; color: var(--theme-main); border: 1px solid var(--theme-main); padding: 12px 24px; border-radius: 40px; cursor: pointer; font-family: var(--font-mono); font-weight: bold;">+ ADD TO CALENDAR</button>
                <a href="${whatsappUrl}" target="_blank" id="continue-wa-btn" class="hover-target" style="background: var(--theme-main); color: white; border: none; padding: 12px 24px; border-radius: 40px; cursor: pointer; font-family: var(--font-mono); font-weight: bold; text-decoration: none;">CONTINUE TO WHATSAPP &rarr;</a>
              </div>
            </div>
          `;
          modal.style.display = 'flex';
          
          document.getElementById('add-to-calendar-btn')?.addEventListener('click', () => {
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
            ].join('\\n');

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
            modal.style.display = 'none';
            fetchSlots(date);
            bookingForm.reset();
            dateInput.value = date;
            timeInput.value = '';
            queueInput.value = 'false';
            submitBtn.innerHTML = 'BOOK VIA WHATSAPP &rarr;';
            submitBtn.disabled = false;
          });
          
          // Re-attach custom cursor hover
          const cursor = document.querySelector('.custom-cursor');
          if (cursor) {
            modal.querySelectorAll('.hover-target').forEach(target => {
              target.addEventListener('mouseenter', () => cursor.classList.add('hover'));
              target.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
            });
          }
        }



      } catch (err) {
        alert('Server error while booking.');
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

  function openMenu() {
    fullscreenMenu.classList.add('active');
    menuBackdrop?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    fullscreenMenu.classList.remove('active');
    menuBackdrop?.classList.remove('active');
    document.body.style.overflow = '';
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

  let adminRefreshInterval: any = null;

  const checkAdmin = () => {
    if (window.location.hash === '#admin') {
      const pwd = prompt("Enter Admin Password:");
      if (pwd === "bobby123") {
        renderAdminDashboard();
        // Auto-refresh every 10 seconds
        if (!adminRefreshInterval) {
          adminRefreshInterval = setInterval(() => {
            if (window.location.hash === '#admin') {
              fetchAdminData();
            } else {
              clearInterval(adminRefreshInterval);
              adminRefreshInterval = null;
            }
          }, 10000);
        }
      } else {
        alert("Incorrect password");
        window.location.hash = '';
      }
    } else {
      if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
      }
      Array.from(document.body.children).forEach(child => {
        if (child.id !== 'admin-container' && !child.classList.contains('custom-cursor') && !child.classList.contains('ambient-glow')) {
          (child as HTMLElement).style.display = '';
        }
      });
      const adminContainer = document.getElementById('admin-container');
      if (adminContainer) adminContainer.style.display = 'none';
    }
  };

  window.addEventListener('hashchange', checkAdmin);
  checkAdmin();

  async function fetchAdminData() {
    try {
      const res = await fetch('/api/admin/bookings');
      const data = await res.json();
      
      const todayStr = new Date().toISOString().split('T')[0];
      const totalToday = data.bookedSlots.filter((b: any) => b.date === todayStr).length;
      const totalWaitlist = data.queue.length;
      const totalCompleted = data.completedSlots.length;

      let html = `
        <div style="display: flex; gap: 2rem; margin-bottom: 3rem;">
          <div class="glassmorphism-dark" style="flex: 1; padding: 2rem; border-radius: 16px; text-align: center;">
            <h3 style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase;">Today's Bookings</h3>
            <p style="color: var(--theme-main); font-family: var(--font-serif); font-size: 4rem; line-height: 1;">${totalToday}</p>
          </div>
          <div class="glassmorphism-dark" style="flex: 1; padding: 2rem; border-radius: 16px; text-align: center;">
            <h3 style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase;">Waitlist Queue</h3>
            <p style="color: #4682B4; font-family: var(--font-serif); font-size: 4rem; line-height: 1;">${totalWaitlist}</p>
          </div>
          <div class="glassmorphism-dark" style="flex: 1; padding: 2rem; border-radius: 16px; text-align: center;">
            <h3 style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase;">Total Completed</h3>
            <p style="color: #2E8B57; font-family: var(--font-serif); font-size: 4rem; line-height: 1;">${totalCompleted}</p>
          </div>
        </div>
        
        <div style="margin-bottom: 2rem;">
          <input type="text" id="admin-search" placeholder="Search by name or phone..." style="width: 100%; padding: 1rem 1.5rem; border-radius: 40px; border: 1px solid rgba(0,0,0,0.1); font-family: var(--font-sans); font-size: 1rem; background: rgba(255,255,255,0.8);">
        </div>
      `;

      html += '<h2 style="margin-top: 0; color: var(--theme-main); font-family: var(--font-serif); font-size: 2.5rem; margin-bottom: 1rem;">Booked Slots</h2>' + 
                 '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse; margin-bottom: 4rem; text-align: left;">' +
                 '<tr style="border-bottom: 2px solid var(--theme-main); color: var(--theme-main); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase;">' +
                 '<th style="padding: 1rem;">Date</th><th style="padding: 1rem;">Time</th><th style="padding: 1rem;">Name</th><th style="padding: 1rem;">Phone</th><th style="padding: 1rem;">Service</th><th style="padding: 1rem;">Barber</th><th style="padding: 1rem;">Actions</th></tr>';
                 
      data.bookedSlots.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.time.localeCompare(b.time));
      data.bookedSlots.forEach((b: any) => {
        html += `<tr class="admin-table-row" data-search="${b.name.toLowerCase()} ${b.phone}" style="border-bottom: 1px solid rgba(0,0,0,0.1); transition: background 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.5)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 1rem;">${b.date}</td><td style="padding: 1rem;"><strong>${b.time}</strong></td><td style="padding: 1rem;">${b.name}</td>
        <td style="padding: 1rem;">${b.phone}</td><td style="padding: 1rem;">${b.service}</td><td style="padding: 1rem;">${b.barber || 'N/A'}</td>
        <td style="padding: 1rem;">
          <button class="admin-action-btn hover-target" data-action="complete" data-id="${b.createdAt}" style="background: var(--theme-main); color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; margin-right: 5px; font-family: var(--font-mono); font-size: 0.8rem; text-transform: uppercase;">Complete</button>
          <button class="admin-action-btn hover-target" data-action="delete" data-id="${b.createdAt}" style="background: transparent; color: red; border: 1px solid red; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-family: var(--font-mono); font-size: 0.8rem; text-transform: uppercase;">Delete</button>
        </td></tr>`;
      });
      html += '</table></div>';

      html += '<h2 style="color: var(--theme-main); font-family: var(--font-serif); font-size: 2.5rem; margin-bottom: 1rem;">Waitlist Queue</h2>' +
              '<div style="overflow-x: auto;"><table style="width:100%; border-collapse: collapse; margin-bottom: 4rem; text-align: left;">' +
                 '<tr style="border-bottom: 2px solid var(--theme-main); color: var(--theme-main); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase;">' +
                 '<th style="padding: 1rem;">Date</th><th style="padding: 1rem;">Time</th><th style="padding: 1rem;">Name</th><th style="padding: 1rem;">Phone</th><th style="padding: 1rem;">Service</th><th style="padding: 1rem;">Barber</th><th style="padding: 1rem;">Actions</th></tr>';
      data.queue.forEach((b: any) => {
        html += `<tr class="admin-table-row" data-search="${b.name.toLowerCase()} ${b.phone}" style="border-bottom: 1px solid rgba(0,0,0,0.1); transition: background 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.5)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 1rem;">${b.date}</td><td style="padding: 1rem;"><strong>${b.time}</strong></td><td style="padding: 1rem;">${b.name}</td>
        <td style="padding: 1rem;">${b.phone}</td><td style="padding: 1rem;">${b.service}</td><td style="padding: 1rem;">${b.barber || 'N/A'}</td>
        <td style="padding: 1rem;">
          <button class="admin-action-btn hover-target" data-action="approve" data-id="${b.createdAt}" style="background: transparent; color: var(--theme-main); border: 1px solid var(--theme-main); padding: 8px 16px; border-radius: 20px; cursor: pointer; margin-right: 5px; font-family: var(--font-mono); font-size: 0.8rem; text-transform: uppercase;">Approve</button>
          <button class="admin-action-btn hover-target" data-action="delete" data-id="${b.createdAt}" style="background: transparent; color: red; border: 1px solid red; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-family: var(--font-mono); font-size: 0.8rem; text-transform: uppercase;">Delete</button>
        </td></tr>`;
      });
      html += '</table></div>';
      
      html += '<h2 style="color: var(--text-secondary); font-family: var(--font-serif); font-size: 2.5rem; margin-bottom: 1rem;">Completed History</h2>' +
              '<div style="overflow-x: auto; opacity: 0.8;"><table style="width:100%; border-collapse: collapse; text-align: left;">' +
                 '<tr style="border-bottom: 2px solid var(--text-secondary); color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem; text-transform: uppercase;">' +
                 '<th style="padding: 1rem;">Date</th><th style="padding: 1rem;">Time</th><th style="padding: 1rem;">Name</th><th style="padding: 1rem;">Phone</th><th style="padding: 1rem;">Service</th><th style="padding: 1rem;">Barber</th></tr>';
      data.completedSlots.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.time.localeCompare(b.time));
      data.completedSlots.forEach((b: any) => {
        html += `<tr class="admin-table-row" data-search="${b.name.toLowerCase()} ${b.phone}" style="border-bottom: 1px solid rgba(0,0,0,0.1); transition: background 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.5)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 1rem;">${b.date}</td><td style="padding: 1rem;"><strong>${b.time}</strong></td><td style="padding: 1rem;">${b.name}</td>
        <td style="padding: 1rem;">${b.phone}</td><td style="padding: 1rem;">${b.service}</td><td style="padding: 1rem;">${b.barber || 'N/A'}</td>
        </tr>`;
      });
      html += '</table></div>';

      const searchInputOld = document.getElementById('admin-search') as HTMLInputElement;
      const currentSearch = searchInputOld ? searchInputOld.value : '';
      const isFocused = searchInputOld && document.activeElement === searchInputOld;

      const adminContentDiv = document.getElementById('admin-content');
      if (adminContentDiv) {
        adminContentDiv.innerHTML = html;
        
        // Search functionality
        const searchInput = document.getElementById('admin-search') as HTMLInputElement;
        if (searchInput) {
          searchInput.value = currentSearch;
          if (isFocused) searchInput.focus();
          
          const applySearch = (query: string) => {
            document.querySelectorAll('.admin-table-row').forEach(row => {
              const text = (row as HTMLElement).dataset.search || '';
              (row as HTMLElement).style.display = text.includes(query) ? '' : 'none';
            });
          };

          searchInput.addEventListener('input', (e) => {
            applySearch((e.target as HTMLInputElement).value.toLowerCase());
          });
          
          if (currentSearch) {
            applySearch(currentSearch.toLowerCase());
          }
        }
      }
    } catch (e) {
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
        <div class="container" style="padding-top: 6rem; padding-bottom: 6rem; min-height: 100vh;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem;">
            <h1 style="color: var(--theme-main); font-family: var(--font-serif); font-size: clamp(2.5rem, 5vw, 4rem);">Admin Dashboard</h1>
            <a href="/" class="outline-btn hover-target" style="text-decoration: none;" onclick="window.location.reload()">Back to Site</a>
          </div>

          <!-- Tabs -->
          <div style="display: flex; gap: 0; margin-bottom: 3rem; border-bottom: 2px solid rgba(0,0,0,0.08);">
            <button id="tab-bookings" onclick="window._adminTab('bookings')" style="font-family: var(--font-mono); font-size: 0.85rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 1rem 2.5rem; background: var(--theme-main); color: white; border: none; cursor: none; border-radius: 8px 8px 0 0; transition: all 0.3s;">📋 Bookings</button>
            <button id="tab-gallery" onclick="window._adminTab('gallery')" style="font-family: var(--font-mono); font-size: 0.85rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 1rem 2.5rem; background: rgba(0,0,0,0.05); color: var(--text-secondary); border: none; cursor: none; border-radius: 8px 8px 0 0; transition: all 0.3s;">🖼 Gallery</button>
          </div>

          <!-- Bookings Panel -->
          <div id="panel-bookings">
            <div id="admin-content" class="glassmorphism-dark">
              <div class="spinner"></div>
              <p style="text-align: center; margin-top: 1rem; font-family: var(--font-mono); color: var(--theme-main);">Loading data...</p>
            </div>
          </div>

          <!-- Gallery Panel -->
          <div id="panel-gallery" style="display:none;">
            <div class="glassmorphism-dark" style="margin-bottom: 2rem;">
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
            <div class="glassmorphism-dark">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                <h2 style="font-family: var(--font-serif); font-size: 2rem; color: var(--theme-main); margin: 0;">Portfolio Collection</h2>
                <span id="gallery-count" style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-secondary); background: rgba(0,0,0,0.05); padding: 0.5rem 1rem; border-radius: 40px;"></span>
              </div>
              <div id="gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem;">
                <div class="spinner" style="grid-column: 1/-1;"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Tab switcher — Gallery tab is password-protected
      let galleryUnlocked = false;
      const GALLERY_PASSWORD = 'Adii@465';

      (window as any)._adminTab = (tab: string) => {
        const bPanel = document.getElementById('panel-bookings')!;
        const gPanel = document.getElementById('panel-gallery')!;
        const bTab   = document.getElementById('tab-bookings')!;
        const gTab   = document.getElementById('tab-gallery')!;

        if (tab === 'bookings') {
          bPanel.style.display = ''; gPanel.style.display = 'none';
          bTab.style.background = 'var(--theme-main)'; bTab.style.color = 'white';
          gTab.style.background = 'rgba(0,0,0,0.05)'; gTab.style.color = 'var(--text-secondary)';
          return;
        }

        // Gallery tab — check password
        if (!galleryUnlocked) {
          const pwd = prompt('🔒 Enter Gallery Password:');
          if (pwd === null) return; // user cancelled
          if (pwd !== GALLERY_PASSWORD) {
            // Wrong password — shake the tab button
            gTab.style.background = '#dc3545';
            gTab.style.color = 'white';
            gTab.animate([
              { transform: 'translateX(0)' },
              { transform: 'translateX(-6px)' },
              { transform: 'translateX(6px)' },
              { transform: 'translateX(-4px)' },
              { transform: 'translateX(4px)' },
              { transform: 'translateX(0)' }
            ], { duration: 400, easing: 'ease-in-out' });
            setTimeout(() => {
              gTab.style.background = 'rgba(0,0,0,0.05)';
              gTab.style.color = 'var(--text-secondary)';
            }, 600);
            alert('❌ Incorrect password.');
            return;
          }
          galleryUnlocked = true;
        }

        // Unlocked — show gallery
        bPanel.style.display = 'none'; gPanel.style.display = '';
        gTab.style.background = 'var(--theme-main)'; gTab.style.color = 'white';
        bTab.style.background = 'rgba(0,0,0,0.05)'; bTab.style.color = 'var(--text-secondary)';
        fetchGalleryData();
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
          const res = await fetch('/api/admin/gallery/upload', { method: 'POST', body: formData });
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
          const res = await fetch(`/api/admin/gallery/${encodeURIComponent(publicId)}`, { method: 'DELETE' });
          if (res.ok) { fetchGalleryData(); }
          else { alert('Delete failed'); target.textContent = 'Delete'; target.style.opacity = '1'; }
          return;
        }

        // Gallery rename
        if (target.matches('.gallery-rename-btn')) {
          const publicId = target.dataset.publicid!;
          const filename = target.dataset.file!;
          const ext = filename.split('.').pop();
          const newName = prompt(`Rename "${filename}" to:`, filename.replace(`.${ext}`, ''));
          if (!newName) return;
          const res = await fetch(`/api/admin/gallery/${encodeURIComponent(publicId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName: `${newName}.${ext}` })
          });
          if (res.ok) { fetchGalleryData(); }
          else { alert('Rename failed'); }
          return;
        }

        // Booking actions
        if (!target.matches('.admin-action-btn')) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (!id || !action) return;
        let url = ''; let method = 'POST';
        if (action === 'delete') { if (!confirm('Delete this entry?')) return; url = `/api/admin/bookings/${id}`; method = 'DELETE'; }
        else if (action === 'complete') { url = `/api/admin/bookings/${id}/complete`; }
        else if (action === 'approve') { url = `/api/admin/queue/${id}/approve`; }
        target.textContent = '…'; target.style.opacity = '0.5';
        try {
          const res = await fetch(url, { method });
          if (res.ok) fetchAdminData(); else { alert('Action failed'); fetchAdminData(); }
        } catch { alert('Network error'); fetchAdminData(); }
      });

    } else {
      container.style.display = 'block';
      const content = document.getElementById('admin-content');
      if (content) content.innerHTML = 'Loading…';
    }
    
    await fetchAdminData();
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
      let currentOrder = [...files];

      const saveOrder = async () => {
        await fetch('/api/admin/gallery/order', {
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
              // Videos use data-src for lazy loading — loaded by IntersectionObserver
              const content = isVideo 
                ? `<video data-src="${src}" loop muted playsinline preload="none" poster="" style="background:#e8e8e0;"></video>`
                : `<img src="${src}" alt="Bobby Salon Work" loading="lazy" />`;
              
              return `<div class="infinite-slider-item">${content}</div>`;
            }).join('');
          };
          
          const itemsHTML = generateItemsHTML();
          // Only duplicate 2x (not 4x) — halves DOM load
          sliderTrack.innerHTML = itemsHTML + itemsHTML;

          // Lazy-load videos when they enter the viewport
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
                // Pause off-screen videos to save resources
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

});
