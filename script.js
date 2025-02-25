document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const diskCountSelect = document.getElementById('diskCount');
    const newGameBtn = document.getElementById('newGame');
    const resetGameBtn = document.getElementById('resetGame');
    const showRulesBtn = document.getElementById('showRules');
    const solutionBtn = document.getElementById('solutionBtn');
    const moveCountSpan = document.getElementById('moveCount');
    const minMovesSpan = document.getElementById('minMoves');
    const rulesModal = document.getElementById('rulesModal');
    const winModal = document.getElementById('winModal');
    const finalMovesSpan = document.getElementById('finalMoves');
    const finalMinMovesSpan = document.getElementById('finalMinMoves');
    const playAgainBtn = document.getElementById('playAgain');
    const closeBtns = document.querySelectorAll('.close');
    
    // Game state
    let towers = [[], [], []];
    let diskCount = 3;
    let moveCount = 0;
    let minMoves = 0;
    let selectedDisk = null;
    let selectedTower = null;
    let gameWon = false;
    let animationInProgress = false;
    let solutionMoves = [];
    let solutionInterval = null;
    
    // Initialize game
    initGame();
    
    // Event listeners
    newGameBtn.addEventListener('click', () => {
        diskCount = parseInt(diskCountSelect.value);
        initGame();
    });
    
    resetGameBtn.addEventListener('click', initGame);
    
    showRulesBtn.addEventListener('click', () => {
        rulesModal.style.display = 'block';
    });
    
    solutionBtn.addEventListener('click', () => {
        stopSolution();
        solutionMoves = [];
        generateSolution(diskCount, 0, 2, 1);
        showSolution();
    });
    
    playAgainBtn.addEventListener('click', () => {
        winModal.style.display = 'none';
        initGame();
    });
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            rulesModal.style.display = 'none';
            winModal.style.display = 'none';
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
            rulesModal.style.display = 'none';
        }
        if (e.target === winModal) {
            winModal.style.display = 'none';
        }
    });
    
    // Game functions
    function initGame() {
        // Stop any running solution
        stopSolution();
        
        // Reset game state
        towers = [[], [], []];
        moveCount = 0;
        gameWon = false;
        selectedDisk = null;
        selectedTower = null;
        
        // Calculate minimum moves
        diskCount = parseInt(diskCountSelect.value);
        minMoves = Math.pow(2, diskCount) - 1;
        
        // Create disks on the first tower
        for (let i = diskCount; i >= 1; i--) {
            towers[0].push(i);
        }
        
        // Update UI
        updateUI();
        moveCountSpan.textContent = '0';
        minMovesSpan.textContent = minMoves;
    }
    
    function updateUI() {
        // Clear all disks from UI
        document.querySelectorAll('.disk').forEach(disk => disk.remove());
        
        // Add disks to towers
        for (let t = 0; t < 3; t++) {
            const diskContainer = document.querySelector(`#tower${t+1} .disk-container`);
            
            towers[t].forEach((diskSize, index) => {
                const disk = document.createElement('div');
                disk.classList.add('disk');
                
                const width = 30 + diskSize * 20;
                disk.style.width = `${width}px`;
                
                // Different colors for different disks
                const hue = (diskSize * 30) % 360;
                disk.style.backgroundColor = `hsl(${hue}, 70%, 50%)`;
                
                disk.textContent = diskSize;
                disk.dataset.size = diskSize;
                disk.dataset.tower = t;
                
                // Add click event
                disk.addEventListener('click', handleDiskClick);
                
                diskContainer.appendChild(disk);
            });
        }
    }
    
    function handleDiskClick(e) {
        if (animationInProgress || gameWon) return;
        
        // Stop any running solution
        stopSolution();
        
        const clickedDisk = e.target;
        const towerIndex = parseInt(clickedDisk.dataset.tower);
        const diskSize = parseInt(clickedDisk.dataset.size);
        
        // Check if this is the top disk of the tower
        if (towers[towerIndex][towers[towerIndex].length - 1] !== diskSize) {
            return;
        }
        
        if (selectedDisk === null) {
            // Select this disk
            selectedDisk = clickedDisk;
            selectedTower = towerIndex;
            clickedDisk.classList.add('selected');
        } else {
            // Attempt to move the selected disk to this tower
            const targetTower = towerIndex;
            const selectedDiskSize = parseInt(selectedDisk.dataset.size);
            
            if (selectedTower === targetTower) {
                // Deselect if clicking the same disk
                selectedDisk.classList.remove('selected');
                selectedDisk = null;
                selectedTower = null;
                return;
            }
            
            // Check if move is valid
            if (canMoveDisk(selectedTower, targetTower)) {
                // Move disk
                moveDisk(selectedTower, targetTower);
            }
            
            // Deselect
            selectedDisk.classList.remove('selected');
            selectedDisk = null;
            selectedTower = null;
        }
    }
    
    function handleTowerClick(e) {
        if (animationInProgress || gameWon) return;
        
        // Stop any running solution
        stopSolution();
        
        // Only process if a disk is already selected
        if (selectedDisk === null) return;
        
        // Find the tower element
        let towerElement = e.target;
        while (!towerElement.classList.contains('tower') && towerElement !== document.body) {
            towerElement = towerElement.parentElement;
        }
        
        if (!towerElement.classList.contains('tower')) return;
        
        // Get tower index
        const targetTower = parseInt(towerElement.id.replace('tower', '')) - 1;
        
        // Don't do anything if clicking the same tower
        if (selectedTower === targetTower) return;
        
        // Check if move is valid
        if (canMoveDisk(selectedTower, targetTower)) {
            // Move disk
            moveDisk(selectedTower, targetTower);
        }
        
        // Deselect
        selectedDisk.classList.remove('selected');
        selectedDisk = null;
        selectedTower = null;
    }
    
    // Add click event to tower bases and rods
    document.querySelectorAll('.tower-base, .tower-rod').forEach(element => {
        element.addEventListener('click', handleTowerClick);
    });
    
    // Add click event to disk containers (for empty towers)
    document.querySelectorAll('.disk-container').forEach(container => {
        container.addEventListener('click', handleTowerClick);
    });
    
    function canMoveDisk(fromTower, toTower) {
        // Can't move if source tower is empty
        if (towers[fromTower].length === 0) return false;
        
        // Can move to empty tower
        if (towers[toTower].length === 0) return true;
        
        // Check size
        const diskSize = towers[fromTower][towers[fromTower].length - 1];
        const topDiskSize = towers[toTower][towers[toTower].length - 1];
        
        return diskSize < topDiskSize;
    }
    
    function moveDisk(fromTower, toTower) {
        // Move disk in data model
        const diskSize = towers[fromTower].pop();
        towers[toTower].push(diskSize);
        
        // Update UI
        updateUI();
        
        // Increment move counter
        moveCount++;
        moveCountSpan.textContent = moveCount;
        
        // Check for win
        checkWin();
    }
    
    function checkWin() {
        // Win if the third tower has all disks
        if (towers[2].length === diskCount) {
            gameWon = true;
            
            // Show win modal
            setTimeout(() => {
                finalMovesSpan.textContent = moveCount;
                finalMinMovesSpan.textContent = minMoves;
                winModal.style.display = 'block';
            }, 500);
        }
    }
    
    function generateSolution(n, source, target, auxiliary) {
        if (n === 1) {
            solutionMoves.push([source, target]);
            return;
        }
        
        generateSolution(n - 1, source, auxiliary, target);
        solutionMoves.push([source, target]);
        generateSolution(n - 1, auxiliary, target, source);
    }
    
    function showSolution() {
        if (solutionMoves.length === 0) return;
        
        // Reset the game first
        initGame();
        
        let moveIndex = 0;
        
        solutionInterval = setInterval(() => {
            if (moveIndex >= solutionMoves.length) {
                stopSolution();
                return;
            }
            
            const [fromTower, toTower] = solutionMoves[moveIndex];
            
            if (canMoveDisk(fromTower, toTower)) {
                moveDisk(fromTower, toTower);
            }
            
            moveIndex++;
        }, 500);
    }
    
    function stopSolution() {
        if (solutionInterval) {
            clearInterval(solutionInterval);
            solutionInterval = null;
        }
    }
});