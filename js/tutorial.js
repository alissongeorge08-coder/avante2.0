/* ============================================================
   TUTORIAL CONTROLLER
   Guided Interactive Spotlight Onboarding
   ============================================================ */

const TUTORIAL_STEPS = [
  {
    targetId: 'map-canvas', // Map acts as background, we will simulate center spotlight
    title: 'Bem-vindo ao AVANTE! 📍',
    text: 'O mapa da cidade é a sua tela principal. Aqui você visualiza todos os problemas reportados perto de você e acompanha como está a zeladoria do seu bairro em tempo real.',
    btnText: 'Próximo →',
    shape: 'rect',
    position: 'center' // How to place dialog relative to target
  },
  {
    targetId: 'nav-ocorrencias',
    title: 'O que está acontecendo? 📊',
    text: 'Toque aqui para ver o Feed de denúncias ao seu redor e acessar o Painel de Transparência, onde mostramos o ranking das instituições.',
    btnText: 'Próximo →',
    shape: 'rect',
    position: 'top'
  },
  {
    targetId: 'nav-foto',
    title: 'O seu poder de denúncia 📸',
    text: 'Encontrou um buraco, vazamento ou rua sem luz? Toque aqui! Importante: A foto precisa ser tirada na hora e no local exato do problema. Nosso GPS cuida do resto.',
    btnText: 'Próximo →',
    shape: 'circle',
    position: 'top'
  },
  {
    targetId: 'nav-perfil',
    title: 'Seu espaço seguro 🛡️',
    text: 'Acompanhe o status das suas denúncias e ative alertas da cidade. Fique tranquilo: sua identidade pública é protegida por um apelido anônimo.',
    btnText: 'Começar a usar! ✔️',
    shape: 'rect',
    position: 'top'
  }
];

const TutorialCtrl = {
  currentStep: 0,
  isActive: false,

  init() {
    // Inject tutorial wrapper if not exists
    if (!document.getElementById('tutorial-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'tutorial-overlay';
      overlay.className = 'tutorial-overlay';
      overlay.style.display = 'none';
      
      overlay.innerHTML = `
        <div id="tutorial-spotlight" class="tutorial-spotlight"></div>
        <div id="tutorial-dialog" class="tutorial-dialog">
          <h3 id="tutorial-title"></h3>
          <p id="tutorial-text"></p>
          <div class="tutorial-footer">
            <div class="tutorial-dots" id="tutorial-dots"></div>
            <button class="btn" id="tutorial-btn" onclick="TutorialCtrl.nextStep()"></button>
          </div>
          <button class="tutorial-skip" onclick="TutorialCtrl.finish()">Pular tutorial</button>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  },

  start() {
    if (DB.isTutorialCompleted()) return;
    this.init();
    this.currentStep = 0;
    this.isActive = true;
    
    // Close any sheets
    if (window.SheetCtrl) SheetCtrl.close();
    
    document.getElementById('tutorial-overlay').style.display = 'block';
    
    // Disable underlying body scrolls/interactions if needed
    // The overlay naturally blocks pointers because it's fixed full-screen
    
    this.renderStep();
  },

  renderStep() {
    const step = TUTORIAL_STEPS[this.currentStep];
    let targetEl = document.getElementById(step.targetId);
    if (step.targetId === 'nav-foto' && targetEl) {
      const ring = targetEl.querySelector('.nav-foto-ring');
      if (ring) targetEl = ring;
    }
    
    if (!targetEl) return this.nextStep(); // Fallback if missing element

    const spotlight = document.getElementById('tutorial-spotlight');
    const dialog = document.getElementById('tutorial-dialog');
    
    // Content update
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-text').textContent = step.text;
    document.getElementById('tutorial-btn').textContent = step.btnText;
    
    // Update dots
    const dotsHtml = TUTORIAL_STEPS.map((_, index) => 
      `<div class="tutorial-dot ${index === this.currentStep ? 'active' : ''}"></div>`
    ).join('');
    document.getElementById('tutorial-dots').innerHTML = dotsHtml;

    // Positioning Spotlight
    const rect = targetEl.getBoundingClientRect();
    
    // For step 1 (map), we want a large fake spotlight in the center
    if (this.currentStep === 0) {
      spotlight.style.width = '300px';
      spotlight.style.height = '300px';
      spotlight.style.left = '50%';
      spotlight.style.top = '40%';
      spotlight.style.transform = 'translate(-50%, -50%)';
      spotlight.style.borderRadius = '50%';
      
      dialog.style.bottom = 'auto';
      dialog.style.top = '65%';
      dialog.style.left = '50%';
      dialog.style.transform = 'translate(-50%, 0)';
    } else {
      // Normal UI elements
      // Add a bit of padding to the bounding rect
      const padding = 8;
      spotlight.style.width = (rect.width + padding * 2) + 'px';
      spotlight.style.height = (rect.height + padding * 2) + 'px';
      spotlight.style.left = (rect.left - padding) + 'px';
      spotlight.style.top = (rect.top - padding) + 'px';
      spotlight.style.transform = 'none';
      
      if (step.shape === 'circle') {
        spotlight.style.borderRadius = '50%';
      } else {
        spotlight.style.borderRadius = '16px';
      }

      // Dialog positioning
      dialog.style.transform = 'translate(-50%, 0)';
      
      if (step.position === 'top') {
        dialog.style.top = 'auto';
        // Position dialog above the element (usually bottom nav)
        dialog.style.bottom = (window.innerHeight - rect.top + 20) + 'px';
        
        // Prevent dialog from going off-screen left/right
        let containerWidth = window.innerWidth;
        let containerLeft = 0;
        
        // If viewing on desktop simulator, constrain to the mobile frame
        const mobileFrame = document.querySelector('.mobile-frame');
        if (mobileFrame && window.innerWidth > 600) {
          const frameRect = mobileFrame.getBoundingClientRect();
          containerWidth = frameRect.width;
          containerLeft = frameRect.left;
        }

        let leftPos = rect.left + (rect.width / 2);
        
        // Dialog is max 320px wide (half is 160px) + 15px safe margin
        const halfWidth = 160;
        const padding = 15;
        
        let minLeft = containerLeft + halfWidth + padding;
        let maxLeft = containerLeft + containerWidth - halfWidth - padding;
        
        if (minLeft > maxLeft) {
           leftPos = containerLeft + containerWidth / 2;
        } else {
           if (leftPos < minLeft) leftPos = minLeft;
           if (leftPos > maxLeft) leftPos = maxLeft;
        }
        
        dialog.style.left = leftPos + 'px';
      }
    }
  },

  nextStep() {
    this.currentStep++;
    if (this.currentStep >= TUTORIAL_STEPS.length) {
      this.finish();
    } else {
      this.renderStep();
    }
  },

  finish() {
    this.isActive = false;
    document.getElementById('tutorial-overlay').style.display = 'none';
    DB.completeTutorial();
  }
};

window.TutorialCtrl = TutorialCtrl;
