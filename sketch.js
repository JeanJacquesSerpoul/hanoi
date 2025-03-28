let towers = [[], [], []];
let numDisks = 5;
let diskHeight;
let maxDiskWidth;
let minDiskWidth;
let towerWidth;
let towerPositions = [];

let selectedDisk = null;
let sourceTower = -1;
let isDragging = false;
let dragOffset = { x: 0, y: 0 }; // Offset from disk center to pointer pos

// Animation state
let isAnimating = false;
let animDisk = null;
let startPos = null;
let targetPos = null;
let animProgress = 0; // 0 to 1
const animSpeed = 0.05; // Adjust for faster/slower animation

// Game state
let moves = 0;
let minMoves = 0;
let startTime = 0;
let timerInterval = null;
let gameWon = false;

// Colors
let diskColors = [];
let canvas; // Garder une référence globale au canvas

function setup() {
    let container = select('#game-container');
    // S'assurer que les dimensions sont basées sur le conteneur
    // Utiliser min pour éviter les problèmes sur les écrans très étroits/larges
    let canvasSize = min(container.width, container.height * 2); // Ajuster le ratio si nécessaire
    // Créer un canvas qui essaie de remplir le conteneur mais garde un ratio ~2:1
    canvas = createCanvas(container.width, container.width / 2); // Forcer un ratio 2:1 pour la largeur
    // Si la hauteur calculée est trop grande pour le conteneur, la réduire
    if (height > container.height) {
       resizeCanvas(container.width * (container.height / height) , container.height);
    }

    canvas.parent('game-container'); // Attach canvas to the container div

    // Recalculer les dimensions basées sur la taille FINALE du canvas
    diskHeight = height / (numDisks + 4); // Donner plus d'espace vertical
    maxDiskWidth = width / 4.5;
    minDiskWidth = width / 15;
    towerWidth = width / 35;

    // Calculate tower base positions
    towerPositions = [
        width / 4,
        width / 2,
        width * 3 / 4
    ];

    // Generate disk colors (using HSB for nice gradients)
    colorMode(HSB, 360, 100, 100);
    diskColors = []; // Vider au cas où setup est appelé de nouveau (bien que resetGame soit mieux)
    for (let i = 0; i < 10; i++) { // Generate colors for up to 10 disks
        diskColors.push(color((i * 360 / 10 + 15) % 360, 85, 85)); // Légère variation de teinte/saturation
    }
    colorMode(RGB); // Switch back to RGB for general drawing

    // Add event listeners for touch handling
    // Utiliser le canvas.elt pour attacher les écouteurs natifs
    if (canvas && canvas.elt) {
        canvas.elt.addEventListener('touchstart', handlePress, { passive: false });
        canvas.elt.addEventListener('touchmove', handleDrag, { passive: false });
        canvas.elt.addEventListener('touchend', handleRelease, { passive: false });
        canvas.elt.addEventListener('touchcancel', handleRelease, { passive: false });
    } else {
        console.error("Canvas element not found for attaching touch listeners.");
    }


    // Initialize game state from HTML select
    let diskSelect = select('#numDisks');
    numDisks = parseInt(diskSelect.value());
    resetGame(); // Appeler resetGame après que tout soit initialisé
}

function draw() {
    background(235, 245, 255); // Bleu très clair

    // --- Draw Towers ---
    drawTowers();

    // --- Draw Disks on Towers (excluding animating disk if it's being returned) ---
    drawStackedDisks();

    // --- Draw Dragged Disk or Animating Disk ---
    if (isDragging && selectedDisk !== null) {
        // Obtenir la position actuelle du pointeur (souris ou toucher)
        let pointerX, pointerY;
        // Vérifier si l'événement tactile est actif (pour handleDrag)
        // Pour draw, on se fie à mouseX/Y qui sont mis à jour par p5 pour la souris
        // et on espère qu'ils sont raisonnablement à jour pour le toucher entre les frames.
        // Pour une précision parfaite du toucher PENDANT le draw, il faudrait stocker
        // la dernière position tactile connue, mais c'est souvent suffisant.
        pointerX = mouseX;
        pointerY = mouseY;

        drawDisk(selectedDisk, pointerX - dragOffset.x, pointerY - dragOffset.y);

    } else if (isAnimating && animDisk !== null) {
        // Interpolate position
        // Ajout d'une courbe d'animation (ease-in-out simple)
        let easedProgress = easeInOutQuad(animProgress);
        let currentX = lerp(startPos.x, targetPos.x, easedProgress);
        let currentY = lerp(startPos.y, targetPos.y, easedProgress);

        // Trajectoire en arc (simple : monter, traverser, descendre)
        let peakHeight = min(startPos.y, targetPos.y) - diskHeight * 3; // Hauteur au-dessus des tours
        if (easedProgress < 0.5) {
            // Montée
            currentY = lerp(startPos.y, peakHeight, easedProgress * 2);
        } else {
            // Descente
            currentY = lerp(peakHeight, targetPos.y, (easedProgress - 0.5) * 2);
        }


        drawDisk(animDisk.disk, currentX, currentY);

        // Update animation progress
        animProgress += animSpeed;
        if (animProgress >= 1) {
            // Animation finished
            isAnimating = false;
            animProgress = 0;
            // Officially place the disk on the target tower
            towers[animDisk.targetTower].push(animDisk.disk);
            animDisk = null; // Nettoyer l'objet d'animation
            checkWin(); // Check win condition after animation completes
        }
    }
}

// Fonction d'easing simple
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}


// --- Drawing Helpers ---

function drawTowers() {
    fill(180, 160, 140); // Brunâtre pour les tours
    noStroke();
    let baseHeight = diskHeight; // Hauteur de la base = hauteur d'un disque
    let pegHeight = height - baseHeight * 1.5; // Laisser un peu d'espace en bas
    let baseWidth = maxDiskWidth * 1.3; // Base un peu plus large que le plus grand disque

    for (let i = 0; i < 3; i++) {
        let x = towerPositions[i];
        // Base
        rectMode(CENTER);
        // Base plus large et moins haute
        rect(x, height - baseHeight / 2, baseWidth, baseHeight, 5); // Coins arrondis
        // Tige
        rect(x, pegHeight / 2 + baseHeight*0.25, towerWidth, pegHeight); // Centrer la tige verticalement
    }
}

function drawStackedDisks() {
    rectMode(CENTER);
    for (let i = 0; i < 3; i++) {
        let towerX = towerPositions[i];
        for (let j = 0; j < towers[i].length; j++) {
            // Ne pas dessiner le disque s'il est celui en cours d'animation
            // (il sera dessiné séparément par la logique d'animation/drag)
             if (isAnimating && animDisk && animDisk.disk === towers[i][j]) {
                 // Si l'animation est en cours ET que c'est CE disque, on saute son dessin ici
                 // MAIS ATTENTION: on ne doit sauter que si on est sûr qu'il est DESSINE par l'animation.
                 // La logique actuelle place le disque dans la tour cible *après* l'animation.
                 // Donc, pendant l'animation, il n'est PAS dans la tour cible.
                 // S'il retourne à sa source, il n'est temporairement nulle part.
                 // --> La logique actuelle où on le retire avant l'anim et le remet après est OK.
                 // --> Donc, on n'a pas besoin de cette vérification ici.
                 // continue; // On ne saute PAS, car il n'est pas encore dans la tour
             }


            let disk = towers[i][j];
            // Position Y basée sur la hauteur de la base et l'index du disque
            let diskY = height - diskHeight - (j * diskHeight) - diskHeight / 2;
            drawDisk(disk, towerX, diskY);
        }
    }
}

function drawDisk(diskValue, x, y) {
    // Assurer que diskValue est un entier valide >= 1
    if (!Number.isInteger(diskValue) || diskValue < 1) return;

    let diskWidth = map(diskValue, 1, numDisks, minDiskWidth, maxDiskWidth);
    // S'assurer que l'index de couleur est valide
    let diskColorIndex = (diskValue - 1) % diskColors.length;
    fill(diskColors[diskColorIndex]);
    stroke(50);
    strokeWeight(1);
    rect(x, y, diskWidth, diskHeight, 5); // Coins arrondis pour les disques
}

// --- Interaction Handlers ---

// p5 mouse events call the unified handlers
function mousePressed(event) {
    // On passe l'événement pour pouvoir le distinguer du toucher si besoin
    handlePress(event);
    // Important: Empêcher le comportement par défaut (ex: sélection de texte)
    return false;
}

function mouseDragged(event) {
    handleDrag(event);
    return false;
}

function mouseReleased(event) {
    handleRelease(event);
    return false;
}

// Unified handler for touchstart and mousedown
function handlePress(event) {
    // Ignorer si animation en cours ou jeu gagné
    if (isAnimating || gameWon) return;

    let mx, my;
    let isTouchEvent = event.type.startsWith('touch');

    if (isTouchEvent) {
        // Utiliser les coordonnées du premier point de contact
        let rect = canvas.elt.getBoundingClientRect();
        mx = event.touches[0].clientX - rect.left;
        my = event.touches[0].clientY - rect.top;
        // Empêcher le défilement/zoom sur mobile pendant l'interaction
        if (event.preventDefault) event.preventDefault();
    } else {
        // Utiliser les coordonnées de la souris fournies par p5 (déjà relatives au canvas)
        mx = mouseX;
        my = mouseY;
    }

    // Ajustement pour la mise à l'échelle CSS si nécessaire (normalement géré par p5)
    // mx *= (width / canvas.elt.offsetWidth);
    // my *= (height / canvas.elt.offsetHeight);

    sourceTower = getTowerFromPos(mx, my);

    if (sourceTower !== -1 && towers[sourceTower].length > 0) {
        // Vérifier si on clique près du disque supérieur
        let topDiskIndex = towers[sourceTower].length - 1;
        let topDisk = towers[sourceTower][topDiskIndex];
        let topDiskY = height - diskHeight - (topDiskIndex * diskHeight) - diskHeight / 2;
        let topDiskWidth = map(topDisk, 1, numDisks, minDiskWidth, maxDiskWidth);
        let towerX = towerPositions[sourceTower];

        // Zone cliquable un peu plus grande que le disque
        if (abs(mx - towerX) < topDiskWidth / 2 + 10 && abs(my - topDiskY) < diskHeight / 2 + 10) {
            // On a cliqué sur le disque supérieur
            selectedDisk = towers[sourceTower].pop(); // Retirer le disque de la tour source
            isDragging = true;

            // Calculer l'offset entre le centre du disque et le point de clic/toucher
            let diskCenterX = towerX;
            let diskCenterY = topDiskY;
            dragOffset.x = mx - diskCenterX;
            dragOffset.y = my - diskCenterY;

            // Démarrer le chrono au premier mouvement valide
            if (!timerInterval && !gameWon) {
                startTimer();
            }
        } else {
            sourceTower = -1; // Clic sur une tour mais pas sur le disque supérieur
        }
    } else {
        sourceTower = -1; // Clic sur une tour vide ou en dehors
    }
}


// Unified handler for touchmove and mousedragged
function handleDrag(event) {
    if (!isDragging || selectedDisk === null) return;

    let isTouchEvent = event.type.startsWith('touch');

    if (isTouchEvent) {
        // Mettre à jour mouseX/Y pour la fonction draw, même si on utilise event coords ici
        let rect = canvas.elt.getBoundingClientRect();
        mouseX = event.touches[0].clientX - rect.left; // Mettre à jour p5's mouseX
        mouseY = event.touches[0].clientY - rect.top;  // Mettre à jour p5's mouseY
        // Empêcher le défilement pendant le drag
         if (event.preventDefault) event.preventDefault();
    }
    // Pour la souris, p5 met à jour mouseX/mouseY automatiquement avant d'appeler mouseDragged/draw

    // La fonction draw() utilisera mouseX/mouseY mis à jour (ou les coords tactiles stockées)
}

// Unified handler for touchend/touchcancel and mouseup
function handleRelease(event) {
    if (!isDragging || selectedDisk === null) return;

    let mx, my;
    let isTouchEvent = event.type.startsWith('touch');

    if (isTouchEvent) {
        // Utiliser changedTouches car 'touches' est vide sur touchend
        if (event.changedTouches && event.changedTouches.length > 0) {
            let rect = canvas.elt.getBoundingClientRect();
            mx = event.changedTouches[0].clientX - rect.left;
            my = event.changedTouches[0].clientY - rect.top;
        } else {
            // Fallback si changedTouches n'est pas dispo (ex: touchcancel?)
            mx = mouseX; // Utiliser la dernière position connue
            my = mouseY;
        }
         if (event.preventDefault) event.preventDefault();
    } else {
        mx = mouseX;
        my = mouseY;
    }

    isDragging = false; // On ne drague plus

    let targetTower = getTowerFromPos(mx, my);

    // --- Logique de validation et d'animation ---
    let isValidMove = false;
    if (targetTower !== -1 && targetTower !== sourceTower) {
        // Mouvement valide si la tour cible est vide OU si le disque est plus petit que celui du dessus
        if (towers[targetTower].length === 0 || selectedDisk < towers[targetTower][towers[targetTower].length - 1]) {
            isValidMove = true;
        }
    }

    // Démarrer l'animation
    isAnimating = true;
    animProgress = 0;

    // Position de départ de l'animation = position actuelle du rendu du disque (avant relâchement)
    startPos = { x: mx - dragOffset.x, y: my - dragOffset.y };

    if (isValidMove) {
        // Position cible = sur le dessus de la pile de la tour cible
        let targetStackHeight = towers[targetTower].length;
        targetPos = {
            x: towerPositions[targetTower],
            y: height - diskHeight - (targetStackHeight * diskHeight) - diskHeight / 2
        };
        // Stocker les infos pour la fin de l'animation
        animDisk = { disk: selectedDisk, targetTower: targetTower };
        moves++;
        updateInfo();
    } else {
        // Mouvement invalide ou relâchement sur la même tour/en dehors
        // Animer le retour vers la tour source
        let sourceStackHeight = towers[sourceTower].length; // Hauteur avant d'avoir retiré le disque
        targetPos = {
            x: towerPositions[sourceTower],
            y: height - diskHeight - (sourceStackHeight * diskHeight) - diskHeight / 2
        };
        // La cible est la tour d'origine
        animDisk = { disk: selectedDisk, targetTower: sourceTower };
        // Ne pas incrémenter les mouvements
    }

    // Réinitialiser la sélection (le disque est maintenant géré par l'animation)
    selectedDisk = null;
    sourceTower = -1;
    dragOffset = { x: 0, y: 0 }; // Réinitialiser l'offset
}

// --- Game Logic ---

function initGame() {
    towers = [[], [], []]; // Vider les tours
    // Ajouter les disques sur la première tour (du plus grand au plus petit)
    for (let i = numDisks; i >= 1; i--) {
        towers[0].push(i);
    }

    // Réinitialiser l'état du jeu
    selectedDisk = null;
    sourceTower = -1;
    isDragging = false;
    isAnimating = false;
    animDisk = null;
    animProgress = 0;

    moves = 0;
    minMoves = pow(2, numDisks) - 1;
    gameWon = false;

    // Réinitialiser et arrêter le chrono
    stopTimer();
    resetTimerDisplay();
    updateInfo(); // Mettre à jour l'affichage des mouvements

    select('#win-message').hide(); // Cacher le message de victoire
    // Recalculer les dimensions des disques si numDisks a changé
    diskHeight = height / (numDisks + 4);
    maxDiskWidth = width / 4.5;
    minDiskWidth = width / 15;

}

// Appelé par le HTML lors du changement de sélection ou clic sur Réinitialiser
function resetGame() {
    let diskSelect = select('#numDisks');
    let newNumDisks = parseInt(diskSelect.value());
    if (newNumDisks !== numDisks) {
         numDisks = newNumDisks;
         // Pas besoin de recréer le canvas, juste réinitialiser le jeu
         // Les dimensions des disques seront recalculées dans initGame
    }
    initGame();
}


function getTowerFromPos(x, y) {
    // Diviser la largeur du canvas en trois régions pour les tours
    let towerRegionWidth = width / 3;
    // Déterminer dans quelle région se trouve x
    if (x >= 0 && x < towerRegionWidth) return 0;
    if (x >= towerRegionWidth && x < towerRegionWidth * 2) return 1;
    if (x >= towerRegionWidth * 2 && x <= width) return 2; // Inclure le bord droit

    return -1; // En dehors des régions des tours
}

function checkWin() {
    // Le jeu est gagné si tous les disques sont sur la tour 2 ou la tour 3
    if (!isAnimating && (towers[1].length === numDisks || towers[2].length === numDisks)) {
        if (!gameWon) { // Vérifier pour ne déclencher qu'une seule fois
            gameWon = true;
            stopTimer();
            select('#win-message').show();
            console.log("Gagné!");
        }
    }
}

function updateInfo() {
    select('#moves').html(moves);
    select('#min-moves').html(minMoves);
}

// --- Timer Functions ---

function startTimer() {
    // Ne démarrer que s'il n'est pas déjà en cours
    if (timerInterval === null) {
        startTime = Date.now() - (moves > 0 ? (/* récupérer temps passé si on reprend */ 0) : 0); // Gérer la reprise? Pour l'instant non.
        timerInterval = setInterval(updateTimer, 1000); // Mettre à jour chaque seconde
        updateTimer(); // Afficher 00:00 immédiatement
    }
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null; // Marquer comme arrêté
}

function updateTimer() {
    if (!startTime) return; // Ne rien faire si le chrono n'a pas démarré

    let elapsedMillis = Date.now() - startTime;
    let elapsedSeconds = Math.floor(elapsedMillis / 1000);
    let minutes = Math.floor(elapsedSeconds / 60);
    let seconds = elapsedSeconds % 60;

    // nf() est une fonction p5 pour formater les nombres (avec zéros devant)
    select('#timer').html(nf(minutes, 2) + ':' + nf(seconds, 2));
}

function resetTimerDisplay() {
    select('#timer').html('00:00');
    startTime = 0; // Réinitialiser le temps de départ
}

// S'assurer que le canvas redimensionne s'il est dans un conteneur flexible
function windowResized() {
   // On pourrait redimensionner le canvas ici, mais cela réinitialiserait
   // certains états p5. Il est souvent plus simple de concevoir pour
   // une taille fixe ou de gérer la responsivité via CSS et de ne
   // créer le canvas qu'une fois dans setup().
   // Si un redimensionnement dynamique est VRAIMENT nécessaire :
   /*
   let container = select('#game-container');
   resizeCanvas(container.width, container.width / 2); // Maintenir le ratio
    if (height > container.height) {
       resizeCanvas(container.width * (container.height / height) , container.height);
    }
   // Recalculer TOUTES les positions/dimensions dépendant de width/height
   towerPositions = [width / 4, width / 2, width * 3 / 4];
   diskHeight = height / (numDisks + 4);
   maxDiskWidth = width / 4.5;
   minDiskWidth = width / 15;
   towerWidth = width / 35;
   // Il faudrait potentiellement redessiner immédiatement ou ajuster l'état actuel.
   // C'est complexe, il vaut mieux souvent l'éviter si possible.
   */
}