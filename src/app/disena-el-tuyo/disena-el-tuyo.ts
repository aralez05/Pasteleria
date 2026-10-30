import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CatalogoService } from '../Catalogo/catalogo.service';
import { HttpClient } from '@angular/common/http';


export interface CakePreset {
  id: string;
  nombre: string;
  descripcion: string;
  pisos: number;
  forma: 'cilindro' | 'cuadrado' | 'corazon' | 'hexagonal';
  color: string;
  tipoGlaseado: 'fondant' | 'chantilly' | 'espejo' | 'naked' | 'terciopelo';
  drip: 'ninguno' | 'chocolate' | 'cajeta' | 'fresa' | 'blanco' | 'oro';
  bordeBase: 'ninguno' | 'perlas' | 'rosetas' | 'cinta_dorada';
  topper: 'ninguno' | 'feliz_cumple' | 'boda' | 'felicidades' | 'xv' | 'velas' | 'numero' | 'corona';
  toppings: {
    fresas: boolean;
    cerezas: boolean;
    macarons: boolean;
    miniConchas: boolean;
    sprinkles: boolean;
    rosas: boolean;
    colorRosa: 'rosa' | 'rojo' | 'cempasuchil' | 'blanco';
  };
  saborBizcocho: string;
  saborRelleno: string;
}

export interface PastelGuardado {
  id: string;
  nombre: string;
  fecha: string;
  precio: number;
  porciones: string;
  detalles: string;
  colorHex: string;
  config: any;
}

@Component({
  selector: 'app-disena-el-tuyo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './disena-el-tuyo.html',
  styleUrl: './disena-el-tuyo.css',
})
export class DisenaElTuyo implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  canvasContainerRef!: ElementRef<HTMLDivElement>;

  protected readonly catalogoService = inject(CatalogoService);

  // --- Three.js runtime references ---
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationFrameId: number | null = null;
  private cakeGroup = new THREE.Group();
  private particlesGroup = new THREE.Group();
  private turntableMesh!: THREE.Group;
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private spotLight!: THREE.SpotLight;
  private candleLight!: THREE.PointLight;
  private clock = new THREE.Clock();
  //Inyeccion http
  private http = inject(HttpClient);

  // Audio Context for sound effects
  private audioCtx: AudioContext | null = null;

  // --- Active Tab in HUD ---
  readonly activeTab = signal<'pisos' | 'glaseado' | 'toppings' | 'topper' | 'inspiraciones' | 'resumen'>('pisos');

  // --- Cake Configuration Signals ---
  readonly pisosCount = signal<number>(2); // 1, 2, 3, 4
  readonly forma = signal<'cilindro' | 'cuadrado' | 'corazon' | 'hexagonal'>('cilindro');
  readonly alturaPiso = signal<'normal' | 'alto'>('normal');

  readonly saborBizcocho = signal<string>('vainilla');
  readonly saborRelleno = signal<string>('cajeta');

  readonly tipoGlaseado = signal<'fondant' | 'chantilly' | 'espejo' | 'naked' | 'terciopelo'>('fondant');
  readonly colorGlaseado = signal<string>('#FFF8E7'); // Vainilla suave
  readonly dripSabor = signal<'ninguno' | 'chocolate' | 'cajeta' | 'fresa' | 'blanco' | 'oro'>('chocolate');

  readonly bordeBase = signal<'ninguno' | 'perlas' | 'rosetas' | 'cinta_dorada'>('rosetas');
  readonly bordeSuperior = signal<'ninguno' | 'perlas_mini' | 'rosetas_mini'>('ninguno');

  // Toppings
  readonly toppingFresas = signal<boolean>(true);
  readonly toppingCerezas = signal<boolean>(false);
  readonly toppingMoras = signal<boolean>(false);
  readonly toppingMacarons = signal<boolean>(true);
  readonly toppingMiniConchas = signal<boolean>(true); // Toque tradicional mexicano!
  readonly toppingSprinkles = signal<boolean>(true);
  readonly toppingRosas = signal<boolean>(false);
  readonly colorRosas = signal<'rosa' | 'rojo' | 'cempasuchil' | 'blanco'>('rosa');

  // Topper & Plaque
  readonly tipoTopper = signal<'ninguno' | 'feliz_cumple' | 'boda' | 'felicidades' | 'xv' | 'velas' | 'numero' | 'corona'>('feliz_cumple');
  readonly numeroEdad = signal<number>(25);
  readonly colorTopper = signal<'oro' | 'plata' | 'rosa'>('oro');

  readonly tienePlaca = signal<boolean>(true);
  readonly textoPlaca = signal<string>('¡Feliz Cumpleaños!');
  readonly colorPlaca = signal<'chocolate' | 'blanco'>('chocolate');

  // Camera & Studio Controls
  readonly autoRotar = signal<boolean>(true);
  readonly modoCorte = signal<boolean>(false); // Rebanada interior para ver capas
  readonly estudioLuz = signal<'pasteleria' | 'neon' | 'romantico' | 'natural'>('pasteleria');
  readonly sonidoHabilitado = signal<boolean>(true);

  // UI state
  readonly modalFichaTecnica = signal<boolean>(false);
  readonly modalGuardados = signal<boolean>(false);
  readonly modalFotoCapturada = signal<string | null>(null);
  readonly toastMensaje = signal<string | null>(null);
  readonly celebrando = signal<boolean>(false);

  // Saved creations from LocalStorage
  readonly pastelesGuardados = signal<PastelGuardado[]>(this.cargarPastelesGuardados());

  // Available Cake Colors Palettes
  readonly paletaColores = [
    { nombre: 'Rosa Mexicano', hex: '#C2185B' },
    { nombre: 'Cempasúchil', hex: '#D35400' },
    { nombre: 'Vainilla Papantla', hex: '#FFF8E7' },
    { nombre: 'Chocolate de Metate', hex: '#3E2723' },
    { nombre: 'Verde Agave', hex: '#117A65' },
    { nombre: 'Celeste Pastel', hex: '#81D4FA' },
    { nombre: 'Lavanda Dulce', hex: '#CE93D8' },
    { nombre: 'Red Velvet Pasión', hex: '#8B0000' },
    { nombre: 'Oro Imperial', hex: '#D4AF37' },
    { nombre: 'Menta Fresca', hex: '#A2D9CE' },
    { nombre: 'Caramelo Dulce', hex: '#E67E22' },
    { nombre: 'Blanco Nieve', hex: '#FFFFFF' },
  ];

  // Presets
  readonly presets: CakePreset[] = [
    {
      id: 'tradicion-mexicana',
      nombre: '🇲🇽 Tradición Olenka',
      descripcion: '2 pisos con crema de cajeta, mini conchas artesanales, perlas doradas y rosas de Cempasúchil.',
      pisos: 2,
      forma: 'cilindro',
      color: '#FFF8E7',
      tipoGlaseado: 'chantilly',
      drip: 'cajeta',
      bordeBase: 'rosetas',
      topper: 'felicidades',
      toppings: {
        fresas: false,
        cerezas: false,
        macarons: false,
        miniConchas: true,
        sprinkles: true,
        rosas: true,
        colorRosa: 'cempasuchil',
      },
      saborBizcocho: 'vainilla',
      saborRelleno: 'cajeta',
    },
    {
      id: 'fiesta-rosa',
      nombre: '💖 Fiesta Rosa Mexicano',
      descripcion: '2 pisos en vibrante Rosa Mexicano con drip de chocolate, macarons, velas mágicas y confeti.',
      pisos: 2,
      forma: 'cilindro',
      color: '#C2185B',
      tipoGlaseado: 'fondant',
      drip: 'chocolate',
      bordeBase: 'perlas',
      topper: 'velas',
      toppings: {
        fresas: true,
        cerezas: false,
        macarons: true,
        miniConchas: false,
        sprinkles: true,
        rosas: true,
        colorRosa: 'rosa',
      },
      saborBizcocho: 'red_velvet',
      saborRelleno: 'frutos_rojos',
    },
    {
      id: 'choco-extremo',
      nombre: '🍫 Choco Cacao Supremo',
      descripcion: '3 pisos con cobertura espejo de chocolate oscuro, fresas glaseadas, macarons y placa de felicitación.',
      pisos: 3,
      forma: 'cilindro',
      color: '#3E2723',
      tipoGlaseado: 'espejo',
      drip: 'chocolate',
      bordeBase: 'rosetas',
      topper: 'feliz_cumple',
      toppings: {
        fresas: true,
        cerezas: true,
        macarons: true,
        miniConchas: false,
        sprinkles: false,
        rosas: false,
        colorRosa: 'rojo',
      },
      saborBizcocho: 'chocolate',
      saborRelleno: 'ganache',
    },
    {
      id: 'boda-real',
      nombre: '💍 Boda Real Elegance',
      descripcion: '4 pisos de ensueño blanco satinado, perlas nacaradas, corona dorada y cascada de rosas blancas.',
      pisos: 4,
      forma: 'cilindro',
      color: '#FFFFFF',
      tipoGlaseado: 'fondant',
      drip: 'oro',
      bordeBase: 'perlas',
      topper: 'boda',
      toppings: {
        fresas: false,
        cerezas: false,
        macarons: false,
        miniConchas: false,
        sprinkles: false,
        rosas: true,
        colorRosa: 'blanco',
      },
      saborBizcocho: 'vainilla',
      saborRelleno: 'diplomatica',
    },
    {
      id: 'corazon-romantico',
      nombre: '❤️ Dulce Amor Corazón',
      descripcion: 'Pastel con forma de corazón en terciopelo rojo, fresas silvestres y placa grabada de amor.',
      pisos: 1,
      forma: 'corazon',
      color: '#8B0000',
      tipoGlaseado: 'terciopelo',
      drip: 'chocolate',
      bordeBase: 'rosetas',
      topper: 'velas',
      toppings: {
        fresas: true,
        cerezas: true,
        macarons: true,
        miniConchas: false,
        sprinkles: true,
        rosas: true,
        colorRosa: 'rojo',
      },
      saborBizcocho: 'red_velvet',
      saborRelleno: 'frutos_rojos',
    },
    {
      id: 'cumpleanos-oro',
      nombre: '✨ Aniversario Corona de Oro',
      descripcion: '2 pisos modernos en azul pastel y oro con corona imperial, macarons y número de edad.',
      pisos: 2,
      forma: 'hexagonal',
      color: '#81D4FA',
      tipoGlaseado: 'espejo',
      drip: 'oro',
      bordeBase: 'cinta_dorada',
      topper: 'corona',
      toppings: {
        fresas: false,
        cerezas: false,
        macarons: true,
        miniConchas: false,
        sprinkles: true,
        rosas: false,
        colorRosa: 'rosa',
      },
      saborBizcocho: 'tres_leches',
      saborRelleno: 'cajeta',
    },
  ];

  // --- Real-time Price and Servings Calculation ---
  readonly porcionesEstimadas = computed(() => {
    switch (this.pisosCount()) {
      case 1:
        return '12 - 15 personas';
      case 2:
        return '25 - 32 personas';
      case 3:
        return '45 - 55 personas';
      case 4:
        return '70 - 85 personas';
      default:
        return '20 personas';
    }
  });

  readonly alturaEstimadaCm = computed(() => {
    const p = this.pisosCount();
    const esAlto = this.alturaPiso() === 'alto';
    const altPorPiso = esAlto ? 14 : 10;
    return p * altPorPiso + 4; // incluye base y decoraciones
  });

  readonly precioCalculado = computed(() => {
    let base = 0;
    switch (this.pisosCount()) {
      case 1:
        base = 450;
        break;
      case 2:
        base = 820;
        break;
      case 3:
        base = 1380;
        break;
      case 4:
        base = 1980;
        break;
    }

    // Forma especial (corazón, hexagonal)
    if (this.forma() === 'corazon' || this.forma() === 'hexagonal') {
      base += 90;
    }

    // Altura especial
    if (this.alturaPiso() === 'alto') {
      base += this.pisosCount() * 60;
    }

    // Cobertura
    if (this.tipoGlaseado() === 'espejo' || this.tipoGlaseado() === 'terciopelo') {
      base += 110;
    }

    // Drip
    if (this.dripSabor() !== 'ninguno') {
      base += this.dripSabor() === 'oro' ? 95 : 65;
    }

    // Bordes
    if (this.bordeBase() !== 'ninguno') {
      base += 50;
    }

    // Toppings
    if (this.toppingFresas()) base += 45;
    if (this.toppingCerezas()) base += 40;
    if (this.toppingMoras()) base += 45;
    if (this.toppingMacarons()) base += 60;
    if (this.toppingMiniConchas()) base += 50;
    if (this.toppingSprinkles()) base += 25;
    if (this.toppingRosas()) base += 55;

    // Topper
    if (this.tipoTopper() === 'corona') base += 130;
    else if (this.tipoTopper() === 'boda') base += 120;
    else if (this.tipoTopper() === 'velas') base += 45;
    else if (this.tipoTopper() === 'feliz_cumple' || this.tipoTopper() === 'felicidades' || this.tipoTopper() === 'xv') base += 85;
    else if (this.tipoTopper() === 'numero') base += 75;

    // Placa
    if (this.tienePlaca() && this.textoPlaca().trim()) {
      base += 45;
    }

    return base;
  });

  ngAfterViewInit(): void {
    this.initThree();
    this.rebuildCake3D();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => { });
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.canvasContainerRef || !this.renderer || !this.camera) return;
    const container = this.canvasContainerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight || 550;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // =========================================================================
  // AUDIO SYNTHESIZER (Web Audio API)
  // =========================================================================
  private ensureAudioContext(): AudioContext | null {
    if (!this.sonidoHabilitado()) return null;
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private playSound(type: 'pop' | 'chime' | 'fanfare' | 'click'): void {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (type === 'click' || type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'pop' ? 620 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(type === 'pop' ? 880 : 330, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'chime') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.15, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.36);
      });
    } else if (type === 'fanfare') {
      const chord = [392, 523.25, 659.25, 783.99, 1046.5]; // Sol, Do, Mi, Sol, Do agudo
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.18, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.65);
      });
    }
  }

  // =========================================================================
  // THREE.JS INITIALIZATION
  // =========================================================================
  private initThree(): void {
    const container = this.canvasContainerRef.nativeElement;
    const width = container.clientWidth || 700;
    const height = container.clientHeight || 550;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfcf8f5); // Cálido repostería suave

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 4.5, 9);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true, // Para captura de foto PNG HD
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // No ir por debajo de la mesa
    this.controls.target.set(0, 1.8, 0);
    this.controls.autoRotate = this.autoRotar();
    this.controls.autoRotateSpeed = 1.2;

    // 5. Lights
    this.setupLighting();

    // 6. Turntable & Environment
    this.setupTurntable();
    this.setupSparkles();

    // 7. Add Cake Group
    this.scene.add(this.cakeGroup);
  }

  private setupLighting(): void {
    // Ambient Light
    this.ambientLight = new THREE.AmbientLight(0xfff7ed, 0.85);
    this.scene.add(this.ambientLight);

    // Main Directional Light (Sol / Foco Cálido de Pastelería)
    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.35);
    this.dirLight.position.set(6, 12, 7);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Soft Fill Light
    const fillLight = new THREE.DirectionalLight(0xfce4ec, 0.5);
    fillLight.position.set(-6, 6, -5);
    this.scene.add(fillLight);

    // Spotlight pointing at the cake
    this.spotLight = new THREE.SpotLight(0xffffff, 0.9, 15, Math.PI / 4, 0.3, 1);
    this.spotLight.position.set(0, 9, 3);
    this.spotLight.target.position.set(0, 1.5, 0);
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);

    // Candle / Glow PointLight for romantic or candle toppers
    this.candleLight = new THREE.PointLight(0xffa726, 0.8, 4);
    this.candleLight.position.set(0, 4.2, 0);
    this.candleLight.visible = false;
    this.scene.add(this.candleLight);
  }

  private setupTurntable(): void {
    this.turntableMesh = new THREE.Group();

    // Base Stand: White marble platter with golden rim
    const platterRadius = 2.4;
    const platterGeo = new THREE.CylinderGeometry(platterRadius, platterRadius, 0.12, 48);
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.05,
    });
    const platter = new THREE.Mesh(platterGeo, marbleMat);
    platter.receiveShadow = true;
    platter.castShadow = true;
    platter.position.y = 0.06;
    this.turntableMesh.add(platter);

    // Golden Rim around platter
    const rimGeo = new THREE.TorusGeometry(platterRadius + 0.02, 0.035, 16, 64);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.2,
    });
    const rim = new THREE.Mesh(rimGeo, goldMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.06;
    this.turntableMesh.add(rim);

    // Pedestal underneath
    const pedestalGeo = new THREE.CylinderGeometry(0.55, 0.9, 0.35, 32);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e2b, // Madera cálida chocolate de metate
      roughness: 0.6,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, woodMat);
    pedestal.position.y = -0.16;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    this.turntableMesh.add(pedestal);

    // Shadow catcher / subtle ground reflection
    const groundGeo = new THREE.PlaneGeometry(14, 14);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.14 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.34;
    ground.receiveShadow = true;
    this.turntableMesh.add(ground);

    this.scene.add(this.turntableMesh);
  }

  private setupSparkles(): void {
    // Floating magical sugar particles drifting gently around the cake
    const particleCount = 45;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.2 + Math.random() * 2.5;
      const angle = Math.random() * Math.PI * 2;
      const y = 0.5 + Math.random() * 4.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      scales[i] = Math.random() * 0.05 + 0.02;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle sprite material
    const particleMat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.12,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geom, particleMat);
    this.particlesGroup.add(particles);
    this.scene.add(this.particlesGroup);
  }

  // =========================================================================
  // PROCEDURAL 3D CAKE GENERATION
  // =========================================================================
  rebuildCake3D(): void {
    if (!this.cakeGroup) return;

    // Clear previous cake objects & dispose geometries
    while (this.cakeGroup.children.length > 0) {
      const child = this.cakeGroup.children[0];
      this.cakeGroup.remove(child);
      // traverse: los Group (drip, toppings, bordes) no tienen geometry propia;
      // hay que liberar la de cada Mesh hija o se acumula memoria GPU en cada rebuild.
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    }

    const pisos = this.pisosCount();
    const forma = this.forma();
    const esAlto = this.alturaPiso() === 'alto';
    const tierHeight = esAlto ? 0.95 : 0.72;
    const corteActivo = this.modoCorte();

    // Radios / Tamaños según cantidad de pisos
    const radiusMap: Record<number, number[]> = {
      1: [1.65],
      2: [1.85, 1.25],
      3: [1.95, 1.45, 0.95],
      4: [2.05, 1.62, 1.18, 0.75],
    };

    const radiuses = radiusMap[pisos] || [1.65];
    let currentY = 0.12; // Just above turntable platter

    // Create Frosting Material
    const frostingMaterial = this.createFrostingMaterial();

    for (let i = 0; i < pisos; i++) {
      const r = radiuses[i];
      const h = tierHeight;
      const tierCenterY = currentY + h / 2;

      // Tier Mesh
      const tierMesh = this.createTierGeometry(forma, r, h, frostingMaterial, corteActivo);
      tierMesh.position.y = tierCenterY;
      tierMesh.castShadow = true;
      tierMesh.receiveShadow = true;
      this.cakeGroup.add(tierMesh);

      // Si está en modo corte, agregar bizcocho y relleno visible interior
      if (corteActivo) {
        const sliceInterior = this.createSliceInterior(forma, r, h, tierCenterY);
        this.cakeGroup.add(sliceInterior);
      }

      // Drip Effect (Gotas que escurren en la orilla superior de cada piso)
      if (this.dripSabor() !== 'ninguno') {
        const dripMesh = this.createDripMesh(forma, r, currentY + h);
        this.cakeGroup.add(dripMesh);
      }

      // Base Border (Rosetas o Perlas)
      if (this.bordeBase() !== 'ninguno') {
        const borderMesh = this.createBorderMesh(this.bordeBase(), forma, r + 0.04, currentY + 0.05);
        this.cakeGroup.add(borderMesh);
      }

      // Toppings decorativos esparcidos en el piso
      this.addToppingsToTier(i, r, currentY + h, pisos);

      currentY += h;
    }

    // Top Tier Topper (Letrero, Velas, Corona, etc.)
    const topRadius = radiuses[radiuses.length - 1];
    this.addTopTopper(currentY, topRadius);

    // Placa de Chocolate personalizada
    if (this.tienePlaca() && this.textoPlaca().trim()) {
      this.addChocolatePlaque(radiuses[0], 0.12 + tierHeight * 0.4);
    }

    // Update lights according to candle topper
    if (this.candleLight) {
      if (this.tipoTopper() === 'velas') {
        this.candleLight.visible = true;
        this.candleLight.position.set(0, currentY + 0.9, 0);
      } else {
        this.candleLight.visible = false;
      }
    }
  }

  private createFrostingMaterial(): THREE.Material {
    const colorHex = parseInt(this.colorGlaseado().replace('#', '0x'), 16);
    const tipo = this.tipoGlaseado();

    switch (tipo) {
      case 'espejo':
        // Glossy mirror glaze with high specular reflection
        return new THREE.MeshPhysicalMaterial({
          color: colorHex,
          roughness: 0.08,
          metalness: 0.15,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          reflectivity: 0.9,
        });
      case 'chantilly':
        // Soft creamy wavy frosting
        return new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.65,
          metalness: 0.02,
        });
      case 'naked':
        // Semi-translucent with cake peaking through
        return new THREE.MeshStandardMaterial({
          color: 0xdfba8c, // Tono bizcocho dorado
          roughness: 0.8,
          metalness: 0.0,
        });
      case 'terciopelo':
        // Soft matte velvet texture
        return new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.92,
          metalness: 0.0,
        });
      case 'fondant':
      default:
        // Satin smooth fondant
        return new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: 0.4,
          metalness: 0.05,
        });
    }
  }

  private createTierGeometry(
    forma: string,
    r: number,
    h: number,
    material: THREE.Material,
    corte: boolean
  ): THREE.Mesh {
    let geom: THREE.BufferGeometry;

    // Angle of slice cutaway: 300 degrees instead of 360 when cut is active
    const thetaLength = corte ? Math.PI * 1.65 : Math.PI * 2;
    const thetaStart = corte ? Math.PI * 0.18 : 0;

    if (forma === 'cuadrado') {
      const size = r * 1.7;
      geom = new THREE.BoxGeometry(size, h, size);
    } else if (forma === 'hexagonal') {
      geom = new THREE.CylinderGeometry(r, r, h, 6, 1, false, thetaStart, thetaLength);
    } else if (forma === 'corazon') {
      // Extruded 3D Heart. El contorno sale de createHeartShape() (ya centrado),
      // la MISMA fuente que usa el drip, así que ambos coinciden siempre.
      const bevel = this.HEART_BEVEL;
      const depth = h - 2 * bevel; // el bisel suma 2*bevel => altura total exacta = h
      geom = new THREE.ExtrudeGeometry(this.createHeartShape(r), {
        depth,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: bevel,
        bevelThickness: bevel,
        bevelOffset: -bevel, // pared exactamente sobre el contorno (sin esto sobresale `bevel`)
      });
      geom.rotateX(Math.PI / 2); // y del shape -> +z
      geom.translate(0, depth / 2, 0); // centra en vertical: y ∈ [-h/2, h/2]
    } else {
      // Cilindro redondo tradicional
      geom = new THREE.CylinderGeometry(r, r, h, 48, 1, false, thetaStart, thetaLength);
    }

    return new THREE.Mesh(geom, material);
  }

  private createSliceInterior(forma: string, r: number, h: number, centerY: number): THREE.Group {
    const sliceGroup = new THREE.Group();
    sliceGroup.position.y = centerY;

    // Sponge color based on selected flavor
    let spongeColor = 0xfff0c4; // Vainilla
    if (this.saborBizcocho() === 'chocolate') spongeColor = 0x4a2e2b;
    else if (this.saborBizcocho() === 'red_velvet') spongeColor = 0x8b1a1a;
    else if (this.saborBizcocho() === 'tres_leches') spongeColor = 0xfff8eb;
    else if (this.saborBizcocho() === 'limon') spongeColor = 0xfef9c3;
    else if (this.saborBizcocho() === 'nuez') spongeColor = 0xd7b899;

    // Filling color based on selected filling
    let fillingColor = 0xd35400; // Cajeta Celaya
    if (this.saborRelleno() === 'diplomatica') fillingColor = 0xfffae0;
    else if (this.saborRelleno() === 'ganache') fillingColor = 0x271406;
    else if (this.saborRelleno() === 'frambuesa') fillingColor = 0x9b111e;
    else if (this.saborRelleno() === 'frutos_rojos') fillingColor = 0x6b1d44;

    const spongeMat = new THREE.MeshStandardMaterial({ color: spongeColor, roughness: 0.85 });
    const fillingMat = new THREE.MeshStandardMaterial({ color: fillingColor, roughness: 0.35 });

    // Alternating visible layers in the wedge plane
    const layerCount = 4;
    const layerH = (h * 0.95) / layerCount;
    for (let l = 0; l < layerCount; l++) {
      const isFilling = l % 2 === 1;
      const lh = isFilling ? layerH * 0.45 : layerH * 1.1;
      const ly = -h / 2 + (l + 0.5) * layerH;

      const layerPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(r * 0.98, lh),
        isFilling ? fillingMat : spongeMat
      );
      layerPlane.position.set((r * 0.98) / 2, ly, 0.01);
      layerPlane.rotation.y = -Math.PI / 2 + 0.15;
      sliceGroup.add(layerPlane);
    }

    return sliceGroup;
  }

  // =========================================================================
  // CONTORNOS (fuente única de verdad para piso, drip y bordes)
  // =========================================================================
  private readonly HEART_BEVEL = 0.05;

  /** Contorno del corazón ya centrado en el origen (centro de su bounding box). */
  private createHeartShape(r: number): THREE.Shape {
    const s = r * 0.95;
    const cy = (s * 0.9 + -s * 1.25) / 2; // centro vertical del contorno
    const y = (v: number) => v - cy;
    const shape = new THREE.Shape();
    shape.moveTo(0, y(s * 0.25));
    shape.bezierCurveTo(0, y(s * 0.25), -s * 0.45, y(s * 0.9), -s * 0.95, y(s * 0.9));
    shape.bezierCurveTo(-s * 1.4, y(s * 0.9), -s * 1.4, y(s * 0.35), -s * 1.4, y(s * 0.35));
    shape.bezierCurveTo(-s * 1.4, y(-s * 0.2), -s * 0.9, y(-s * 0.65), 0, y(-s * 1.25));
    shape.bezierCurveTo(s * 0.9, y(-s * 0.65), s * 1.4, y(-s * 0.2), s * 1.4, y(s * 0.35));
    shape.bezierCurveTo(s * 1.4, y(s * 0.35), s * 1.4, y(s * 0.9), s * 0.95, y(s * 0.9));
    shape.bezierCurveTo(s * 0.45, y(s * 0.9), 0, y(s * 0.25), 0, y(s * 0.25));
    return shape;
  }
  private getTierOutline(
    forma: string,
    r: number,
    corte: boolean
  ): { points: THREE.Vector2[]; closed: boolean } {
    const points: THREE.Vector2[] = [];

    if (forma === 'cuadrado') {
      const half = (r * 1.7) / 2;
      const corners = [
        [-half, -half],
        [half, -half],
        [half, half],
        [-half, half],
      ];
      const perEdge = 25;
      for (let e = 0; e < 4; e++) {
        const [x1, z1] = corners[e];
        const [x2, z2] = corners[(e + 1) % 4];
        for (let i = 0; i < perEdge; i++) {
          points.push(new THREE.Vector2(x1 + ((x2 - x1) * i) / perEdge, z1 + ((z2 - z1) * i) / perEdge));
        }
      }
      return { points, closed: true }; // el cuadrado no se corta en createTierGeometry
    }

    if (forma === 'corazon') {
      const pts = this.createHeartShape(r).getSpacedPoints(100);
      // En un contorno cerrado el último punto repite al primero
      if (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
      pts.forEach((p) => points.push(new THREE.Vector2(p.x, p.y)));
      return { points, closed: true }; // el corazón tampoco se corta
    }

    // Cilindro y hexágono: mismo barrido angular que en createTierGeometry
    const thetaStart = corte ? Math.PI * 0.18 : 0;
    const thetaLength = corte ? Math.PI * 1.65 : Math.PI * 2;
    const at = (t: number) => {
      const th = thetaStart + t * thetaLength;
      return new THREE.Vector2(Math.sin(th) * r, Math.cos(th) * r);
    };

    if (forma === 'hexagonal') {
      const sides = 6;
      const perEdge = 17;
      for (let s = 0; s < sides; s++) {
        const a = at(s / sides);
        const b = at((s + 1) / sides);
        for (let i = 0; i < perEdge; i++) points.push(new THREE.Vector2().lerpVectors(a, b, i / perEdge));
      }
    } else {
      const n = 96;
      for (let i = 0; i < n; i++) points.push(at(i / n));
    }
    if (corte) points.push(at(1)); // arco abierto: cerramos en el borde del corte
    return { points, closed: !corte };
  }

  // =========================================================================
  // DRIP MESH GENERATION (Gotas 3D de Cobertura)
  // =========================================================================
  private createDripMesh(forma: string, r: number, topY: number): THREE.Group {
    const group = new THREE.Group();
    group.position.y = topY;

    let dripColor = 0x3e2723; // Chocolate
    if (this.dripSabor() === 'cajeta') dripColor = 0xd35400;
    else if (this.dripSabor() === 'fresa') dripColor = 0xc2185b;
    else if (this.dripSabor() === 'blanco') dripColor = 0xffffff;
    else if (this.dripSabor() === 'oro') dripColor = 0xd4af37;

    const dripMat = new THREE.MeshPhysicalMaterial({
      color: dripColor,
      roughness: 0.15,
      metalness: this.dripSabor() === 'oro' ? 0.8 : 0.08,
      clearcoat: 0.8,
    });

    // Contorno EXACTO del piso (misma fuente que createTierGeometry)
    const { points, closed } = this.getTierOutline(forma, r, this.modoCorte());
    const n = points.length;

    // Anillo superior
    const curvePoints = points.map((p) => new THREE.Vector3(p.x, -0.01, p.y));
    const rimPath = new THREE.CatmullRomCurve3(curvePoints, closed);
    const rimGeom = new THREE.TubeGeometry(rimPath, n, 0.045, 8, closed);
    group.add(new THREE.Mesh(rimGeom, dripMat));

    // Sentido del contorno (shoelace): define de qué lado queda "hacia afuera"
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const side = area >= 0 ? 1 : -1;

    const dropCount = Math.max(1, Math.floor(r * 14));
    const step = Math.max(1, Math.round(n / dropCount));
    for (let i = 0; i < n; i += step) {
      const p = points[i];
      const prev = points[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
      const next = points[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      const tx = next.x - prev.x;
      const tz = next.y - prev.y;
      const len = Math.hypot(tx, tz) || 1;
      const nx = (side * tz) / len; // normal exterior X
      const nz = (-side * tx) / len; // normal exterior Z

      // Mover la gota ligeramente hacia afuera para que caiga sobre el borde exacto
      const dropX = p.x + nx * 0.015;
      const dropZ = p.y + nz * 0.015;

      // Vary droplet lengths procedurally
      const length = 0.08 + Math.sin(i * 3.7) * 0.12 + (i % 3 === 0 ? 0.18 : 0.02);
      const dropRadius = 0.035;

      const dropMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(dropRadius * 0.7, dropRadius, length, 8),
        dripMat
      );
      dropMesh.position.set(dropX, -length / 2, dropZ);

      // Droplet rounded bottom
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(dropRadius * 1.15, 8, 8), dripMat);
      bulb.position.set(dropX, -length, dropZ);

      group.add(dropMesh);
      group.add(bulb);
    }

    return group;
  }

  // =========================================================================
  // BASE BORDERS (Rosetas / Perlas / Cinta Dorada)
  // =========================================================================
  private createBorderMesh(tipo: string, forma: string, r: number, y: number): THREE.Group {
    const group = new THREE.Group();
    group.position.y = y;

    if (tipo === 'cinta_dorada') {
      const ribbonMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.85,
        roughness: 0.2,
      });
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(r - 0.02, 0.038, 12, 48), ribbonMat);
      ribbon.rotation.x = Math.PI / 2;
      group.add(ribbon);
      return group;
    }

    const count = Math.floor(r * 22);
    const isPerlas = tipo === 'perlas';

    const pearlMat = new THREE.MeshStandardMaterial({
      color: isPerlas ? 0xfbfbfb : 0xfff8eb,
      metalness: isPerlas ? 0.35 : 0.0,
      roughness: isPerlas ? 0.2 : 0.6,
    });

    const elementRadius = isPerlas ? 0.045 : 0.065;
    const geom = isPerlas
      ? new THREE.SphereGeometry(elementRadius, 12, 12)
      : new THREE.ConeGeometry(elementRadius, 0.09, 8);

    for (let i = 0; i < count; i++) {
      if (this.modoCorte() && i < count * 0.18) continue;
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const element = new THREE.Mesh(geom, pearlMat);
      element.position.set(x, 0, z);
      if (!isPerlas) {
        element.rotation.x = Math.PI;
      }
      group.add(element);
    }

    return group;
  }

  // =========================================================================
  // TOPPINGS (Fresas, Macarons, Mini Conchas, Rosas, Sprinkles)
  // =========================================================================
  private addToppingsToTier(tierIndex: number, r: number, surfaceY: number, totalTiers: number): void {
    const isTopTier = tierIndex === totalTiers - 1;
    const toppingGroup = new THREE.Group();
    toppingGroup.position.y = surfaceY;

    // 1. Fresas Glaseadas
    if (this.toppingFresas()) {
      const fresaCount = isTopTier ? 6 : 4;
      for (let i = 0; i < fresaCount; i++) {
        const angle = (i / fresaCount) * Math.PI * 2 + 0.3;
        const dist = isTopTier ? r * 0.6 : r * 0.85;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        toppingGroup.add(this.createStrawberry3D(x, 0.08, z));
      }
    }

    // 2. Cerezas con tallo
    if (this.toppingCerezas()) {
      const cerezaCount = isTopTier ? 4 : 3;
      for (let i = 0; i < cerezaCount; i++) {
        const angle = (i / cerezaCount) * Math.PI * 2 + 0.8;
        const dist = isTopTier ? r * 0.45 : r * 0.88;
        toppingGroup.add(this.createCherry3D(Math.cos(angle) * dist, 0.07, Math.sin(angle) * dist));
      }
    }

    // 3. Mini Conchas Mexicanas Tradicionales
    if (this.toppingMiniConchas()) {
      const conchaCount = isTopTier ? 3 : 2;
      for (let i = 0; i < conchaCount; i++) {
        const angle = (i / conchaCount) * Math.PI * 2 + 1.2;
        const dist = isTopTier ? r * 0.52 : r * 0.82;
        const esChoco = i % 2 === 0;
        toppingGroup.add(this.createMiniConcha3D(Math.cos(angle) * dist, 0.06, Math.sin(angle) * dist, esChoco));
      }
    }

    // 4. Macarons Franceses
    if (this.toppingMacarons()) {
      const macaronCount = isTopTier ? 4 : 3;
      const colors = [0xf48fb1, 0x80cbc4, 0xfff59d, 0xce93d8];
      for (let i = 0; i < macaronCount; i++) {
        const angle = (i / macaronCount) * Math.PI * 2 + 1.9;
        const dist = isTopTier ? r * 0.58 : r * 0.86;
        toppingGroup.add(
          this.createMacaron3D(Math.cos(angle) * dist, 0.08, Math.sin(angle) * dist, colors[i % colors.length])
        );
      }
    }

    // 5. Rosas de Azúcar 3D
    if (this.toppingRosas()) {
      const roseCount = isTopTier ? 3 : 2;
      let roseColor = 0xc2185b; // Rosa
      if (this.colorRosas() === 'rojo') roseColor = 0xc62828;
      else if (this.colorRosas() === 'cempasuchil') roseColor = 0xe67e22;
      else if (this.colorRosas() === 'blanco') roseColor = 0xffffff;

      for (let i = 0; i < roseCount; i++) {
        const angle = (i / roseCount) * Math.PI * 2 + 2.5;
        const dist = isTopTier ? r * 0.4 : r * 0.84;
        toppingGroup.add(this.createSugarRose3D(Math.cos(angle) * dist, 0.09, Math.sin(angle) * dist, roseColor));
      }
    }

    // 6. Sprinkles / Chispas de Colores
    if (this.toppingSprinkles() && isTopTier) {
      const sprinkleCount = 40;
      const sprinkleColors = [0xff1744, 0x00e676, 0xffea00, 0x2979ff, 0xff9100];
      for (let i = 0; i < sprinkleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (r * 0.85);
        const col = sprinkleColors[i % sprinkleColors.length];
        const sprinkleMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 })
        );
        sprinkleMesh.position.set(Math.cos(angle) * dist, 0.02, Math.sin(angle) * dist);
        sprinkleMesh.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
        toppingGroup.add(sprinkleMesh);
      }
    }

    this.cakeGroup.add(toppingGroup);
  }

  // --- 3D Strawberry Builder ---
  private createStrawberry3D(x: number, y: number, z: number): THREE.Group {
    const strawberry = new THREE.Group();
    strawberry.position.set(x, y, z);

    // Berry Body (Ruby Red with slight gloss)
    const berryGeo = new THREE.ConeGeometry(0.08, 0.16, 12);
    const berryMat = new THREE.MeshPhysicalMaterial({
      color: 0xd32f2f,
      roughness: 0.25,
      clearcoat: 0.7,
    });
    const berry = new THREE.Mesh(berryGeo, berryMat);
    berry.rotation.x = Math.PI; // Point down
    strawberry.add(berry);

    // Green leafy stem
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.5 });
    for (let j = 0; j < 5; j++) {
      const leafGeo = new THREE.ConeGeometry(0.02, 0.06, 4);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const leafAngle = (j / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(leafAngle) * 0.035, 0.07, Math.sin(leafAngle) * 0.035);
      leaf.rotation.z = 0.5;
      leaf.rotation.y = leafAngle;
      strawberry.add(leaf);
    }

    strawberry.rotation.y = Math.random() * Math.PI;
    strawberry.rotation.z = (Math.random() - 0.5) * 0.2;
    return strawberry;
  }

  // --- 3D Cherry Builder ---
  private createCherry3D(x: number, y: number, z: number): THREE.Group {
    const cherryGroup = new THREE.Group();
    cherryGroup.position.set(x, y, z);

    // Glossy Red Sphere
    const cherryMat = new THREE.MeshPhysicalMaterial({
      color: 0x990011,
      roughness: 0.12,
      clearcoat: 0.9,
    });
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), cherryMat);
    cherryGroup.add(cherry);

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x33691e });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(0.02, 0.11, 0);
    stem.rotation.z = -0.35;
    cherryGroup.add(stem);

    return cherryGroup;
  }

  // --- 3D Mini Concha Mexicana Builder ---
  private createMiniConcha3D(x: number, y: number, z: number, esChocolate: boolean): THREE.Group {
    const concha = new THREE.Group();
    concha.position.set(x, y, z);

    // Bun Base (Masa dorada)
    const bunGeo = new THREE.SphereGeometry(0.09, 16, 12);
    bunGeo.scale(1, 0.5, 1);
    const bunMat = new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 0.7 });
    const bun = new THREE.Mesh(bunGeo, bunMat);
    concha.add(bun);

    // Sugar Crust (Costra de Azúcar con patrón de caracol/concha)
    const crustColor = esChocolate ? 0x3e2723 : 0xffffff;
    const crustMat = new THREE.MeshStandardMaterial({ color: crustColor, roughness: 0.8 });
    const crustGeo = new THREE.SphereGeometry(0.093, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    crustGeo.scale(1, 0.52, 1);
    const crust = new THREE.Mesh(crustGeo, crustMat);
    concha.add(crust);

    concha.rotation.y = Math.random() * Math.PI;
    concha.rotation.x = 0.15;
    return concha;
  }

  // --- 3D Macaron Builder ---
  private createMacaron3D(x: number, y: number, z: number, colorHex: number): THREE.Group {
    const macaron = new THREE.Group();
    macaron.position.set(x, y, z);

    const shellMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });

    // Top shell
    const topShell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8), shellMat);
    topShell.scale.set(1, 0.45, 1);
    topShell.position.y = 0.035;
    macaron.add(topShell);

    // Cream layer
    const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16), creamMat);
    macaron.add(cream);

    // Bottom shell
    const btmShell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8), shellMat);
    btmShell.scale.set(1, 0.45, 1);
    btmShell.position.y = -0.035;
    macaron.add(btmShell);

    macaron.rotation.y = Math.random() * Math.PI;
    macaron.rotation.z = 0.25; // Inclinado juguetonamente
    return macaron;
  }

  // --- 3D Sugar Rose Builder ---
  private createSugarRose3D(x: number, y: number, z: number, colorHex: number): THREE.Group {
    const rose = new THREE.Group();
    rose.position.set(x, y, z);

    const petalMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });

    // Central bud
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), petalMat);
    rose.add(bud);

    // Spiral petals
    for (let p = 0; p < 8; p++) {
      const petalGeo = new THREE.CylinderGeometry(0.03 + p * 0.008, 0.03 + p * 0.008, 0.04, 8, 1, true);
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.rotation.y = p * 1.1;
      petal.rotation.x = 0.2;
      petal.scale.set(1 + p * 0.12, 1, 1 + p * 0.12);
      rose.add(petal);
    }

    return rose;
  }

  // =========================================================================
  // TOPPERS (Letreros 3D, Velas con Flama, Coronas)
  // =========================================================================
  private addTopTopper(topY: number, topRadius: number): void {
    const tipo = this.tipoTopper();
    if (tipo === 'ninguno') return;

    const topperGroup = new THREE.Group();
    topperGroup.position.set(0, topY, 0);

    const topperColorHex =
      this.colorTopper() === 'oro' ? 0xd4af37 : this.colorTopper() === 'plata' ? 0xe0e0e0 : 0xc2185b;

    const goldMat = new THREE.MeshStandardMaterial({
      color: topperColorHex,
      metalness: 0.85,
      roughness: 0.2,
    });

    if (tipo === 'velas') {
      // 3 Birthday Candles with Flickering Flame!
      const candlePositions = [
        { x: -0.22, z: 0 },
        { x: 0.22, z: 0 },
        { x: 0, z: 0.22 },
      ];
      candlePositions.forEach((pos) => {
        const candleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const candleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 12), candleMat);
        candleBody.position.set(pos.x, 0.19, pos.z);
        topperGroup.add(candleBody);

        // Flame (Animated glowing teardrop)
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9800 });
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), flameMat);
        flame.position.set(pos.x, 0.42, pos.z);
        topperGroup.add(flame);
      });
    } else if (tipo === 'corona') {
      // Imperial Golden Crown
      const crownBase = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 12, 32), goldMat);
      crownBase.rotation.x = Math.PI / 2;
      crownBase.position.y = 0.08;
      topperGroup.add(crownBase);

      for (let c = 0; c < 6; c++) {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), goldMat);
        const a = (c / 6) * Math.PI * 2;
        peak.position.set(Math.cos(a) * 0.35, 0.2, Math.sin(a) * 0.35);
        peak.rotation.y = a;
        topperGroup.add(peak);
      }
    } else if (tipo === 'numero') {
      // 3D Number Plate / Age
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8), goldMat);
      stick.position.set(0, 0.175, 0);
      topperGroup.add(stick);

      // Gold Disc with Number drawn via Canvas
      const numCanvas = document.createElement('canvas');
      numCanvas.width = 256;
      numCanvas.height = 256;
      const ctx = numCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#D4AF37';
        ctx.beginPath();
        ctx.arc(128, 128, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2C1810';
        ctx.font = 'bold 120px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(this.numeroEdad()), 128, 128);
      }
      const numTex = new THREE.CanvasTexture(numCanvas);
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.04, 32),
        [goldMat, new THREE.MeshBasicMaterial({ map: numTex }), new THREE.MeshBasicMaterial({ map: numTex })]
      );
      disc.position.set(0, 0.45, 0);
      disc.rotation.y = -Math.PI / 2;
      topperGroup.add(disc);
    } else {
      // 3D Calligraphy Sign (Feliz Cumpleaños, Boda, XV Años)
      let textStr = '¡Feliz Cumpleaños!';
      if (tipo === 'boda') textStr = 'Nuestra Boda ❤️';
      else if (tipo === 'felicidades') textStr = '¡Felicidades!';
      else if (tipo === 'xv') textStr = 'Mis XV Años ✨';

      // Support sticks
      const stick1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), goldMat);
      stick1.position.set(-0.25, 0.18, 0);
      const stick2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), goldMat);
      stick2.position.set(0.25, 0.18, 0);
      topperGroup.add(stick1);
      topperGroup.add(stick2);

      // Textured Acrylic Golden Arch Sign
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 512, 256);
        ctx.fillStyle = 'rgba(212, 175, 55, 0.95)';
        ctx.roundRect(16, 20, 480, 216, 30);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 8;
        ctx.roundRect(24, 28, 464, 200, 24);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 50px Playfair Display, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(textStr, 256, 128);
      }
      const tex = new THREE.CanvasTexture(canvas);
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.48),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
      );
      signMesh.position.set(0, 0.45, 0);
      topperGroup.add(signMesh);
    }

    this.cakeGroup.add(topperGroup);
  }

  // =========================================================================
  // CHOCOLATE PLAQUE WITH CUSTOM MESSAGE
  // =========================================================================
  private addChocolatePlaque(bottomRadius: number, plaqueY: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const esChoco = this.colorPlaca() === 'chocolate';
    ctx.fillStyle = esChoco ? '#2C1810' : '#FFFDF8';
    ctx.roundRect(10, 10, 492, 160, 20);
    ctx.fill();

    // Golden decorative border
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.roundRect(18, 18, 476, 144, 15);
    ctx.stroke();

    // User Text
    ctx.fillStyle = esChoco ? '#F5D77F' : '#C2185B';
    ctx.font = 'bold 36px Caveat, cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.textoPlaca().substring(0, 32), 256, 90);

    const tex = new THREE.CanvasTexture(canvas);
    const plaqueMat = new THREE.MeshBasicMaterial({ map: tex });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 0.04), plaqueMat);

    // Place at front base of cake angled upwards
    plaque.position.set(0, plaqueY, bottomRadius + 0.12);
    plaque.rotation.x = -0.15;
    this.cakeGroup.add(plaque);
  }

  // =========================================================================
  // ANIMATION LOOP
  // =========================================================================
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    if (this.controls) {
      this.controls.update();
    }

    // Gentle floating sparkles
    if (this.particlesGroup) {
      this.particlesGroup.rotation.y = elapsedTime * 0.06;
    }

    // Candle flame flicker
    if (this.candleLight && this.candleLight.visible) {
      this.candleLight.intensity = 0.8 + Math.sin(elapsedTime * 15) * 0.25;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  // =========================================================================
  // CAMERA VIEW PRESETS
  // =========================================================================
  setCameraPreset(preset: 'frontal' | 'isometrica' | 'cenital' | 'rebanada'): void {
    if (!this.camera || !this.controls) return;
    this.playSound('pop');

    switch (preset) {
      case 'frontal':
        this.camera.position.set(0, 2.2, 7.5);
        this.controls.target.set(0, 1.8, 0);
        this.modoCorte.set(false);
        break;
      case 'isometrica':
        this.camera.position.set(5.5, 5.0, 5.5);
        this.controls.target.set(0, 1.6, 0);
        this.modoCorte.set(false);
        break;
      case 'cenital':
        this.camera.position.set(0, 8.5, 0.5);
        this.controls.target.set(0, 1.5, 0);
        this.modoCorte.set(false);
        break;
      case 'rebanada':
        this.modoCorte.set(true);
        this.camera.position.set(3.8, 2.8, 4.2);
        this.controls.target.set(0, 1.6, 0);
        break;
    }

    this.rebuildCake3D();
  }

  toggleAutoRotar(): void {
    this.autoRotar.update((v) => !v);
    if (this.controls) {
      this.controls.autoRotate = this.autoRotar();
    }
    this.playSound('click');
  }

  cambiarEstudioLuz(estilo: 'pasteleria' | 'neon' | 'romantico' | 'natural'): void {
    this.estudioLuz.set(estilo);
    this.playSound('click');

    if (!this.ambientLight || !this.dirLight || !this.scene) return;

    switch (estilo) {
      case 'neon':
        this.scene.background = new THREE.Color(0x1a092b);
        this.ambientLight.color.setHex(0x9c27b0);
        this.ambientLight.intensity = 0.6;
        this.dirLight.color.setHex(0x00e5ff);
        this.dirLight.intensity = 1.4;
        break;
      case 'romantico':
        this.scene.background = new THREE.Color(0x2a1715);
        this.ambientLight.color.setHex(0xff7043);
        this.ambientLight.intensity = 0.5;
        this.dirLight.color.setHex(0xffab91);
        this.dirLight.intensity = 0.9;
        break;
      case 'natural':
        this.scene.background = new THREE.Color(0xf0fdf4);
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.9;
        this.dirLight.color.setHex(0xfffaed);
        this.dirLight.intensity = 1.3;
        break;
      case 'pasteleria':
      default:
        this.scene.background = new THREE.Color(0xfcf8f5);
        this.ambientLight.color.setHex(0xfff7ed);
        this.ambientLight.intensity = 0.85;
        this.dirLight.color.setHex(0xfffaed);
        this.dirLight.intensity = 1.35;
        break;
    }
  }

  // =========================================================================
  // ACTIONS & HUD CONTROLS
  // =========================================================================
  setPisos(n: number): void {
    this.pisosCount.set(n);
    this.rebuildCake3D();
    this.playSound('pop');
  }

  setForma(f: 'cilindro' | 'cuadrado' | 'corazon' | 'hexagonal'): void {
    this.forma.set(f);
    this.rebuildCake3D();
    this.playSound('chime');
  }

  setColor(hex: string): void {
    this.colorGlaseado.set(hex);
    this.rebuildCake3D();
    this.playSound('pop');
  }

  setTipoGlaseado(tipo: 'fondant' | 'chantilly' | 'espejo' | 'naked' | 'terciopelo'): void {
    this.tipoGlaseado.set(tipo);
    this.rebuildCake3D();
    this.playSound('click');
  }

  setDrip(sabor: 'ninguno' | 'chocolate' | 'cajeta' | 'fresa' | 'blanco' | 'oro'): void {
    this.dripSabor.set(sabor);
    this.rebuildCake3D();
    this.playSound('pop');
  }

  setBordeBase(borde: 'ninguno' | 'perlas' | 'rosetas' | 'cinta_dorada'): void {
    this.bordeBase.set(borde);
    this.rebuildCake3D();
    this.playSound('click');
  }

  toggleTopping(
    tipo: 'fresas' | 'cerezas' | 'moras' | 'macarons' | 'miniConchas' | 'sprinkles' | 'rosas'
  ): void {
    switch (tipo) {
      case 'fresas':
        this.toppingFresas.update((v) => !v);
        break;
      case 'cerezas':
        this.toppingCerezas.update((v) => !v);
        break;
      case 'moras':
        this.toppingMoras.update((v) => !v);
        break;
      case 'macarons':
        this.toppingMacarons.update((v) => !v);
        break;
      case 'miniConchas':
        this.toppingMiniConchas.update((v) => !v);
        break;
      case 'sprinkles':
        this.toppingSprinkles.update((v) => !v);
        break;
      case 'rosas':
        this.toppingRosas.update((v) => !v);
        break;
    }
    this.rebuildCake3D();
    this.playSound('pop');
  }

  setTopper(t: 'ninguno' | 'feliz_cumple' | 'boda' | 'felicidades' | 'xv' | 'velas' | 'numero' | 'corona'): void {
    this.tipoTopper.set(t);
    this.rebuildCake3D();
    this.playSound('chime');
  }

  aplicarPreset(preset: CakePreset): void {
    this.pisosCount.set(preset.pisos);
    this.forma.set(preset.forma);
    this.colorGlaseado.set(preset.color);
    this.tipoGlaseado.set(preset.tipoGlaseado);
    this.dripSabor.set(preset.drip);
    this.bordeBase.set(preset.bordeBase);
    this.tipoTopper.set(preset.topper);

    this.toppingFresas.set(preset.toppings.fresas);
    this.toppingCerezas.set(preset.toppings.cerezas);
    this.toppingMacarons.set(preset.toppings.macarons);
    this.toppingMiniConchas.set(preset.toppings.miniConchas);
    this.toppingSprinkles.set(preset.toppings.sprinkles);
    this.toppingRosas.set(preset.toppings.rosas);
    this.colorRosas.set(preset.toppings.colorRosa);

    this.saborBizcocho.set(preset.saborBizcocho);
    this.saborRelleno.set(preset.saborRelleno);

    this.rebuildCake3D();
    this.playSound('fanfare');
    this.mostrarToast(`¡Inspiración "${preset.nombre}" aplicada con éxito!`);
  }

  // =========================================================================
  // SNAPSHOT / FOTO HD
  // =========================================================================
  capturarFotoHD(): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    this.modalFotoCapturada.set(dataUrl);
    this.playSound('fanfare');
  }

  descargarFoto(): void {
    const dataUrl = this.modalFotoCapturada();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `Olenka_Ezis_Pastel_3D_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    this.mostrarToast('¡Foto 3D guardada en tu dispositivo!');
  }

  // =========================================================================
  // PERSISTENCE (LocalStorage) & CART INTEGRATION
  // =========================================================================
  private cargarPastelesGuardados(): PastelGuardado[] {
    try {
      const data = localStorage.getItem('olenka_ezis_pasteles_disenados');
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return [];
  }

  guardarDisenoActual(): void {
    const nuevo: PastelGuardado = {
      id: 'custom-' + Date.now(),
      nombre: `Pastel Personalizado (${this.pisosCount()} pisos)`,
      fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
      precio: this.precioCalculado(),
      porciones: this.porcionesEstimadas(),
      detalles: `${this.forma()} • Sabor ${this.saborBizcocho()} • Glaseado ${this.tipoGlaseado()}`,
      colorHex: this.colorGlaseado(),
      config: {
        pisos: this.pisosCount(),
        forma: this.forma(),
        color: this.colorGlaseado(),
        glaseado: this.tipoGlaseado(),
        drip: this.dripSabor(),
        topper: this.tipoTopper(),
        textoPlaca: this.textoPlaca(),
      },
    };

    const actualizados = [nuevo, ...this.pastelesGuardados()];
    this.pastelesGuardados.set(actualizados);
    try {
      localStorage.setItem('olenka_ezis_pasteles_disenados', JSON.stringify(actualizados));
    } catch { }

    this.playSound('fanfare');
    this.celebrando.set(true);
    setTimeout(() => this.celebrando.set(false), 3000);
    this.mostrarToast('✨ ¡Tu diseño ha sido guardado en "Mis Creaciones"!');
  }

  cargarDiseno(pastel: PastelGuardado): void {
    if (!pastel.config) return;
    const c = pastel.config;
    if (c.pisos) this.pisosCount.set(c.pisos);
    if (c.forma) this.forma.set(c.forma);
    if (c.color) this.colorGlaseado.set(c.color);
    if (c.glaseado) this.tipoGlaseado.set(c.glaseado);
    if (c.drip) this.dripSabor.set(c.drip);
    if (c.topper) this.tipoTopper.set(c.topper);
    if (c.textoPlaca) this.textoPlaca.set(c.textoPlaca);

    this.rebuildCake3D();
    this.modalGuardados.set(false);
    this.playSound('chime');
    this.mostrarToast(`¡Diseño "${pastel.nombre}" cargado en el taller 3D!`);
  }

  borrarDiseno(id: string, ev: Event): void {
    ev.stopPropagation();
    const filtrados = this.pastelesGuardados().filter((p) => p.id !== id);
    this.pastelesGuardados.set(filtrados);
    try {
      localStorage.setItem('olenka_ezis_pasteles_disenados', JSON.stringify(filtrados));
    } catch { }
    this.playSound('click');
    this.mostrarToast('Diseño eliminado de tu colección.');
  }

  agregarAlCarritoPedido(): void {
    // Integra el pastel personalizado al catálogo y selección
    const nuevoProducto = {
      nombre: `Pastel 3D Personalizado (${this.pisosCount()} pisos - ${this.forma()})`,
      categoria: 'Pasteles Personalizados',
      descripcion: `Diseño 3D: Bizcocho de ${this.saborBizcocho()}, relleno de ${this.saborRelleno()}, cobertura ${this.tipoGlaseado()} en ${this.colorGlaseado()}. Topper: ${this.tipoTopper()}. Mensaje: "${this.textoPlaca()}".`,
      sabor: `${this.saborBizcocho()} & ${this.saborRelleno()}`,
      precio: this.precioCalculado(),
      stock: 10,
      imagen: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=600&q=80',
      badge: 'Diseño 3D',
      porciones: this.porcionesEstimadas(),
    };

    // Al llamar a agregarProducto, nos suscribimos al Observable para recibir el producto guardado en MySQL Aiven
    this.catalogoService.agregarProducto(nuevoProducto).subscribe({
      next: (creado) => {
        // 'creado' ya contiene el objeto Producto con su 'id' generado por el servidor
        this.catalogoService.incrementarSeleccion(creado.id);

        this.playSound('fanfare');
        this.celebrando.set(true);
        setTimeout(() => this.celebrando.set(false), 3500);
        this.mostrarToast('🎉 ¡Pastel 3D agregado a tu pedido! Puedes revisarlo en Catálogo / Facturación.');
      },
      error: (err) => {
        alert('Error al guardar el pastel personalizado en la base de datos.');
        console.error('Error al agregar pastel 3D:', err);
      }
    });
  }
  mostrarToast(msj: string): void {
    this.toastMensaje.set(msj);
    setTimeout(() => {
      this.toastMensaje.set(null);
    }, 4000);
  }
  async guardarDisenoConImagen() {
    // 1. Verificar que exista una captura de imagen
    const imagenBase64 = this.modalFotoCapturada();
    if (!imagenBase64) {
      this.toastMensaje.set('Por favor, toma una Foto HD primero antes de guardar.');
      return;
    }

    try {
      // 2. Convertir el texto Base64 de la imagen a un archivo real (Blob)
      const respuestaFetch = await fetch(imagenBase64);
      const blobImagen = await respuestaFetch.blob();

      // 3. Crear el objeto JSON con toda la configuración del pastel
      const configuracionPastel = {
        pisos: this.pisosCount(),
        forma: this.forma(),
        altura: this.alturaPiso(),
        saborBizcocho: this.saborBizcocho(),
        saborRelleno: this.saborRelleno(),
        glaseado: {
          tipo: this.tipoGlaseado(),
          colorHex: this.colorGlaseado(),
          drip: this.dripSabor()
        },
        toppings: {
          fresas: this.toppingFresas(),
          cerezas: this.toppingCerezas(),
          miniConchas: this.toppingMiniConchas(),
          macarons: this.toppingMacarons(),
          rosas: this.toppingRosas() ? this.colorRosas() : null,
          sprinkles: this.toppingSprinkles()
        },
        topper: this.tipoTopper(),
        placa: this.tienePlaca() ? this.textoPlaca() : null,
        precioTotal: this.precioCalculado()
      };

      // 4. Empaquetar la imagen y el JSON usando FormData
      const formData = new FormData();
      formData.append('imagen_referencia', blobImagen, 'pastel_captura.png');
      formData.append('configuracion', JSON.stringify(configuracionPastel));

      // 5. Enviar el FormData a tu backend
     this.http.post('https://bakcend-5pyr.onrender.com/api/guardar-diseno', formData).subscribe({
        next: (respuesta: any) => {
          this.toastMensaje.set('¡Diseño y foto guardados con éxito!');
          this.modalFotoCapturada.set(null); // Cerrar el modal tras guardar
        },
        error: (error: any) => {
          console.error('Error al guardar el diseño', error);
          this.toastMensaje.set('Hubo un error al guardar tu diseño.');
        }
      });

    } catch (error) {
      console.error('Error al procesar la imagen', error);
    }
  }
}

