/**
 * ElevenReaction app.js (Minimal Version)
 * Redesigned collision engine and kinetics rules focusing on clean visualization and low particle count.
 */

// --- Global Simulation Constants & State ---
const canvas = document.getElementById('reactorCanvas');
const ctx = canvas.getContext('2d');

let volumeValue = 5.0; // Current volume in Liters (affects piston Y coordinate)
let totalPressure = 1.0;
let particles = [];

// Cleaned up equilibrium reaction settings
const PARTICLE_TYPES = {
  NO2: 'NO2',
  N2O4: 'N2O4'
};

const PROPERTIES = {
  [PARTICLE_TYPES.NO2]: {
    radius: 9,      // Slightly larger particles for better clarity
    mass: 1,
    color: '#b25329', // Clear Red-Brown for NO₂
    glow: 'rgba(178, 83, 41, 0.8)'
  },
  [PARTICLE_TYPES.N2O4]: {
    radius: 16,     // Larger N2O4 particles for better distinction
    mass: 2,
    color: '#ffffff', // Pure Luminous White for N₂O₄
    glow: 'rgba(255, 255, 255, 0.8)'
  }
};

// Graph details
const chartCanvas = document.getElementById('chartCanvas');
const chartCtx = chartCanvas.getContext('2d');
let concentrationHistory = [];
const maxHistoryLength = 200;

// Particle class definition
class Particle {
  constructor(type, x, y, vx, vy) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = PROPERTIES[type].radius;
    this.mass = PROPERTIES[type].mass;
    this.color = PROPERTIES[type].color;
    this.glow = PROPERTIES[type].glow;
  }

  update(pistonY) {
    // Apply position
    this.x += this.vx;
    this.y += this.vy;

    // Wall Collisions
    const bounce = -0.98; // High elasticity
    
    // Left boundary
    if (this.x - this.radius < 10) {
      this.x = 10 + this.radius;
      this.vx *= bounce;
    }
    // Right boundary
    if (this.x + this.radius > canvas.width - 10) {
      this.x = canvas.width - 10 - this.radius;
      this.vx *= bounce;
    }
    // Bottom boundary
    if (this.y + this.radius > canvas.height - 10) {
      this.y = canvas.height - 10 - this.radius;
      this.vy *= bounce;
    }
    // Top Piston Boundary
    if (this.y - this.radius < pistonY) {
      this.y = pistonY + this.radius;
      this.vy = Math.abs(this.vy) * 0.98; // bounce downwards
    }
  }

  draw() {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.glow;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Initialize minimal particles list
function initParticles() {
  particles = [];
  const pistonY = getPistonY();
  
  // Dramatically reduced numbers (12 NO2 particles + 3 N2O4 particles) to avoid chaotic/messy layouts
  const initialNO2 = 12;
  const initialN2O4 = 3;

  for (let i = 0; i < initialNO2; i++) {
    spawnParticle(PARTICLE_TYPES.NO2, pistonY);
  }
  for (let i = 0; i < initialN2O4; i++) {
    spawnParticle(PARTICLE_TYPES.N2O4, pistonY);
  }
}

function spawnParticle(type, pistonY) {
  const radius = PROPERTIES[type].radius;
  let attempts = 0;
  while (attempts < 50) {
    const x = Math.random() * (canvas.width - 40 - radius * 2) + 20 + radius;
    const y = Math.random() * (canvas.height - 40 - pistonY - radius * 2) + pistonY + radius;
    
    // Ensure it doesn't overlap existing particles
    let overlap = false;
    for (let p of particles) {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < p.radius + radius + 8) {
        overlap = true;
        break;
      }
    }
    
    if (!overlap) {
      // Moderate speed to make it easy to follow
      const baseSpeed = type === PARTICLE_TYPES.NO2 ? 2.0 : 1.2;
      const angle = Math.random() * Math.PI * 2;
      const vx = Math.cos(angle) * baseSpeed;
      const vy = Math.sin(angle) * baseSpeed;
      particles.push(new Particle(type, x, y, vx, vy));
      break;
    }
    attempts++;
  }
}

function getPistonY() {
  const minVol = 2.0;
  const maxVol = 8.0;
  const minY = 60;
  const maxY = 380;
  
  const pct = (volumeValue - minVol) / (maxVol - minVol);
  return maxY - pct * (maxY - minY);
}

// Adjust volume based on target Y position inside canvas
function updateVolumeFromY(y) {
  const minY = 60;
  const maxY = 380;
  const clampedY = Math.max(minY, Math.min(maxY, y));
  
  const pct = (maxY - clampedY) / (maxY - minY);
  const minVol = 2.0;
  const maxVol = 8.0;
  volumeValue = Math.round((minVol + pct * (maxVol - minVol)) * 10) / 10;
  
  document.getElementById('sliderVolume').value = volumeValue;
  document.getElementById('lblSliderVolume').textContent = volumeValue.toFixed(1) + " L";
  document.getElementById('valVolume').textContent = volumeValue.toFixed(1) + " L";
}

// Particle collision engine (Elastic 2D Collisions)
function resolveCollisions() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const p1 = particles[i];
      const p2 = particles[j];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = p1.radius + p2.radius;

      if (dist < minDist) {
        // Handle Chemical Reaction check upon collision
        if (checkChemicalReaction(p1, p2, i, j)) {
          return; // Collision array layout changed, break to next frame
        }

        // Normal Elastic Collision Physics
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Rotate velocities
        const vx1 = p1.vx * cos + p1.vy * sin;
        const vy1 = p1.vy * cos - p1.vx * sin;
        const vx2 = p2.vx * cos + p2.vy * sin;
        const vy2 = p2.vy * cos - p2.vx * sin;

        // Mass-based elastic bounce equations
        const vx1Final = ((p1.mass - p2.mass) * vx1 + 2 * p2.mass * vx2) / (p1.mass + p2.mass);
        const vx2Final = ((p2.mass - p1.mass) * vx2 + 2 * p1.mass * vx1) / (p1.mass + p2.mass);

        // Update velocities back
        p1.vx = vx1Final * cos - vy1 * sin;
        p1.vy = vy1 * cos + vx1Final * sin;
        p2.vx = vx2Final * cos - vy2 * sin;
        p2.vy = vy2 * cos + vx2Final * sin;

        // Push apart to prevent overlap sticking
        const overlap = minDist - dist;
        p1.x -= (overlap / 2) * cos;
        p1.y -= (overlap / 2) * sin;
        p2.x += (overlap / 2) * cos;
        p2.y += (overlap / 2) * sin;
      }
    }
  }
}

/**
 * 2 NO2 -> N2O4 (Probability scales with density / pressure)
 * N2O4 -> 2 NO2 (Spontaneous constant rate)
 */
function checkChemicalReaction(p1, p2, idx1, idx2) {
  if (p1.type === PARTICLE_TYPES.NO2 && p2.type === PARTICLE_TYPES.NO2) {
    // Association probability strictly tied to how low the volume is
    // Min volume 2.0L -> High probability (1.0), Max volume 8.0L -> Zero probability
    const targetVolume = 8.0;
    const associationChance = Math.max(0.0, (targetVolume - volumeValue) / 6.0) * 0.5;
    
    if (Math.random() < associationChance) {
      // Fuse them!
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const cvx = (p1.vx + p2.vx) / 2;
      const cvy = (p1.vy + p2.vy) / 2;

      particles.splice(idx2, 1);
      particles.splice(idx1, 1);

      particles.push(new Particle(PARTICLE_TYPES.N2O4, cx, cy, cvx * 0.8, cvy * 0.8));
      return true; // Structure changed
    }
  }
  return false;
}

// Handle N2O4 spontaneous dissociation
function handleDissociation() {
  // Dissociation probability strictly tied to how high the volume is
  // Max volume 8.0L -> High probability (0.05), Min volume 2.0L -> Zero probability
  const minVolume = 2.0;
  const dissociationChance = Math.max(0.0, (volumeValue - minVolume) / 6.0) * 0.04;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type === PARTICLE_TYPES.N2O4) {
      if (Math.random() < dissociationChance) {
        // Split into 2 NO2
        particles.splice(i, 1);
        
        const angle = Math.random() * Math.PI * 2;
        const offset = 12;
        const x1 = p.x + Math.cos(angle) * offset;
        const y1 = p.y + Math.sin(angle) * offset;
        const x2 = p.x - Math.cos(angle) * offset;
        const y2 = p.y - Math.sin(angle) * offset;

        const speed = 2.0;
        const vx1 = Math.cos(angle) * speed;
        const vy1 = Math.sin(angle) * speed;
        const vx2 = -Math.cos(angle) * speed;
        const vy2 = -Math.sin(angle) * speed;

        particles.push(new Particle(PARTICLE_TYPES.NO2, x1, y1, vx1, vy1));
        particles.push(new Particle(PARTICLE_TYPES.NO2, x2, y2, vx2, vy2));
      }
    }
  }
}

// Calculate pressure and telemetry
function calculateSystemStats() {
  const n = particles.length;
  // Scaled telemetry output for realistic atmosphere readouts
  const calculatedP = (n * 0.35) / volumeValue;
  totalPressure = calculatedP;

  document.getElementById('valPressure').textContent = totalPressure.toFixed(2) + " atm";
  
  const no2Count = particles.filter(p => p.type === PARTICLE_TYPES.NO2).length;
  const n2o4Count = particles.filter(p => p.type === PARTICLE_TYPES.N2O4).length;
  document.getElementById('valNo2Count').textContent = no2Count + " molecules";
  document.getElementById('valN2o4Count').textContent = n2o4Count + " molecules";

  // Record concentrations for the chart
  concentrationHistory.push({ no2: no2Count, n2o4: n2o4Count });
  if (concentrationHistory.length > maxHistoryLength) {
    concentrationHistory.shift();
  }
}

// Render real-time line chart
function drawChart() {
  chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  
  const rect = chartCanvas.getBoundingClientRect();
  chartCanvas.width = rect.width;
  chartCanvas.height = rect.height;

  const w = chartCanvas.width;
  const h = chartCanvas.height;
  const padding = 20;

  // Draw chart grid lines
  chartCtx.strokeStyle = '#e5e5e5';
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  chartCtx.moveTo(padding, h - padding);
  chartCtx.lineTo(w - padding, h - padding);
  chartCtx.stroke();

  if (concentrationHistory.length < 2) return;

  const maxVal = 25; // Scale maximum down to accommodate lower counts
  const stepX = (w - padding * 2) / (maxHistoryLength - 1);
  const scaleY = (h - padding * 2) / maxVal;

  function drawLine(key, color) {
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();
    
    for (let i = 0; i < concentrationHistory.length; i++) {
      const val = concentrationHistory[i][key];
      const x = padding + i * stepX;
      const y = h - padding - (val * scaleY);
      
      if (i === 0) {
        chartCtx.moveTo(x, y);
      } else {
        chartCtx.lineTo(x, y);
      }
    }
    chartCtx.stroke();
  }

  drawLine('no2', '#b25329');
  drawLine('n2o4', '#ffffff');
}

// Update Piston dragging logic
let isDraggingPiston = false;

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseY = e.clientY - rect.top;
  const pistonY = getPistonY();

  if (Math.abs(mouseY - pistonY) < 30) {
    isDraggingPiston = true;
    canvas.style.cursor = 'grabbing';
  }
});

window.addEventListener('mouseup', () => {
  if (isDraggingPiston) {
    isDraggingPiston = false;
    canvas.style.cursor = 'grab';
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (isDraggingPiston) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    updateVolumeFromY(mouseY);
  }
});

// Touch controls for mobile support
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    const rect = canvas.getBoundingClientRect();
    const touchY = e.touches[0].clientY - rect.top;
    const pistonY = getPistonY();
    if (Math.abs(touchY - pistonY) < 40) {
      isDraggingPiston = true;
    }
  }
});

canvas.addEventListener('touchend', () => {
  isDraggingPiston = false;
});

canvas.addEventListener('touchmove', (e) => {
  if (isDraggingPiston && e.touches.length === 1) {
    const rect = canvas.getBoundingClientRect();
    const touchY = e.touches[0].clientY - rect.top;
    updateVolumeFromY(touchY);
    e.preventDefault();
  }
});

// Hook DOM slider controls
document.getElementById('sliderVolume').addEventListener('input', (e) => {
  volumeValue = parseFloat(e.target.value);
  document.getElementById('lblSliderVolume').textContent = volumeValue.toFixed(1) + " L";
  document.getElementById('valVolume').textContent = volumeValue.toFixed(1) + " L";
});

// Reset simulation trigger
document.getElementById('btnResetSimulation').addEventListener('click', () => {
  initParticles();
  concentrationHistory = [];
});

// Draw the core canvas reactor chamber (Obsidian glass with piston plunger)
function drawReactor() {
  ctx.fillStyle = '#060810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pistonY = getPistonY();

  // Color background based on NO2 concentration
  const no2Count = particles.filter(p => p.type === PARTICLE_TYPES.NO2).length;
  const ratio = no2Count / (particles.length || 1);
  ctx.fillStyle = `rgba(184, 91, 52, ${0.05 + ratio * 0.25})`; 
  ctx.fillRect(10, pistonY, canvas.width - 20, canvas.height - pistonY - 10);

  // Plunger
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(8, pistonY - 12, canvas.width - 16, 15);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, pistonY - 12, canvas.width - 16, 15);

  // Piston shaft
  ctx.fillStyle = '#334155';
  ctx.fillRect(canvas.width / 2 - 12, 0, 24, pistonY - 12);
  ctx.strokeRect(canvas.width / 2 - 12, 0, 24, pistonY - 12);

  // Border walls
  ctx.strokeStyle = '#38bdf8'; 
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(10, canvas.height - 10);
  ctx.lineTo(canvas.width - 10, canvas.height - 10);
  ctx.lineTo(canvas.width - 10, 0);
  ctx.stroke();

  // Update physics
  const steps = 3;
  for (let s = 0; s < steps; s++) {
    for (let p of particles) {
      p.update(pistonY);
    }
    resolveCollisions();
  }

  // Kinetics dissociation
  handleDissociation();

  // Render particles
  for (let p of particles) {
    p.draw();
  }
}

// Main Game Loop
function tick() {
  drawReactor();
  calculateSystemStats();
  drawChart();
  requestAnimationFrame(tick);
}

// Initialize
initParticles();
tick();
