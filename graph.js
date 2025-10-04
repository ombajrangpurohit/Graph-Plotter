  document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('graph-canvas');
            const ctx = canvas.getContext('2d');
            const functionList = document.getElementById('function-list');
            const addFunctionBtn = document.getElementById('add-function-btn');
            const themeToggle = document.getElementById('theme-toggle');
            const menuToggle = document.getElementById('menu-toggle');
            const controlPanel = document.getElementById('control-panel');
            const coordsDisplay = document.getElementById('coords');
            const helpBtn = document.getElementById('help-btn');
            const helpModal = document.getElementById('help-modal');
            const closeModalBtn = document.getElementById('close-modal-btn');

            let functions = [];
            const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#8b5cf6', '#ec4899'];
            let nextColorIndex = 0;

            let transform = {
                scale: 50, // pixels per unit
                offsetX: 0, // pan x in pixels
                offsetY: 0, // pan y in pixels
                centerX: 0,
                centerY: 0,
            };
            
            let isDragging = false;
            let lastMousePos = { x: 0, y: 0 };
            
            // --- Initialization ---
            function init() {
                resizeCanvas();
                setupEventListeners();
                const stateExists = loadState();
                if (!stateExists) {
                    // Only add defaults if there was no saved state at all
                    addNewFunction('sin(x)');
                    addNewFunction('x^2');
                }
                draw();
            }

            function resizeCanvas() {
                const dpr = window.devicePixelRatio || 1;
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                transform.centerX = canvas.width / (2 * dpr);
                transform.centerY = canvas.height / (2 * dpr);
                draw();
            }
            
            // --- State Management ---
            function saveState() {
                localStorage.setItem('graphPlotterState', JSON.stringify({
                    functions: functions.map(f => ({ expression: f.expression, color: f.color })),
                    theme: document.documentElement.className,
                }));
            }

            function loadState() {
                const savedState = localStorage.getItem('graphPlotterState');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    document.documentElement.className = state.theme || 'light';
                    themeToggle.checked = state.theme === 'dark';

                    // Use saved functions if they exist, even if it's an empty array
                    if (state.functions && Array.isArray(state.functions)) {
                        functionList.innerHTML = '';
                        functions = [];
                        nextColorIndex = 0;
                        state.functions.forEach(func => {
                            addNewFunction(func.expression, func.color);
                        });
                    }
                    return true; // A state was found and loaded
                }
                return false; // No state was found
            }

            // --- Event Listeners ---
            function setupEventListeners() {
                window.addEventListener('resize', resizeCanvas);
                addFunctionBtn.addEventListener('click', () => addNewFunction());
                themeToggle.addEventListener('change', toggleTheme);
                menuToggle.addEventListener('click', toggleMenu);

                canvas.addEventListener('mousedown', startPan);
                canvas.addEventListener('mouseup', endPan);
                canvas.addEventListener('mouseleave', endPan);
                canvas.addEventListener('mousemove', pan);
                canvas.addEventListener('mousemove', updateCoords);
                canvas.addEventListener('wheel', zoom);

                helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
                closeModalBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
                helpModal.addEventListener('click', (e) => {
                    if (e.target === helpModal) {
                        helpModal.classList.add('hidden');
                    }
                });
            }

            function toggleTheme() {
                document.documentElement.classList.toggle('dark');
                document.documentElement.classList.toggle('light');
                draw();
                saveState();
            }

            function toggleMenu() {
                controlPanel.classList.toggle('-translate-x-full');
            }

            // --- Function Management ---
            function addNewFunction(expression = '', color = null) {
                const id = `func-${Date.now()}`;
                const functionColor = color || colors[nextColorIndex % colors.length];
                if (!color) {
                    nextColorIndex++;
                }

                const funcDiv = document.createElement('div');
                funcDiv.id = id;
                funcDiv.className = 'flex items-center space-x-2';
                
                funcDiv.innerHTML = `
                    <div class="w-2 h-6 rounded-full" style="background-color: ${functionColor};"></div>
                    <span class="font-mono text-lg">y =</span>
                    <input type="text" class="input-field w-full p-2 rounded-md border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" value="${expression}">
                    <button class="remove-btn p-1.5 rounded-md btn-hover">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                `;
                
                functionList.appendChild(funcDiv);
                
                const input = funcDiv.querySelector('input');
                const newFunc = {
                    id: id,
                    expression: expression,
                    color: functionColor,
                    compiled: null
                };

                compileFunction(newFunc);
                functions.push(newFunc);

                input.addEventListener('input', () => {
                    newFunc.expression = input.value;
                    compileFunction(newFunc);
                    draw();
                    saveState();
                });

                funcDiv.querySelector('.remove-btn').addEventListener('click', () => {
                    functions = functions.filter(f => f.id !== id);
                    funcDiv.remove();
                    draw();
                    saveState();
                });
                
                draw();
                saveState();
            }

            function compileFunction(func) {
                try {
                    func.compiled = math.compile(func.expression);
                    func.error = null;
                } catch (e) {
                    func.compiled = null;
                    func.error = e.message;
                }
            }
            
            // --- Coordinate Transformations & Interaction ---
            const screenToWorld = (sx, sy) => {
                const dpr = window.devicePixelRatio || 1;
                const wx = (sx - transform.centerX - transform.offsetX/dpr) / transform.scale;
                const wy = -(sy - transform.centerY - transform.offsetY/dpr) / transform.scale;
                return { x: wx, y: wy };
            };
            
            function startPan(e) {
                isDragging = true;
                lastMousePos = { x: e.clientX, y: e.clientY };
            }

            function endPan() {
                isDragging = false;
            }

            function pan(e) {
                if (!isDragging) return;
                const dx = e.clientX - lastMousePos.x;
                const dy = e.clientY - lastMousePos.y;
                const dpr = window.devicePixelRatio || 1;
                transform.offsetX += dx * dpr;
                transform.offsetY += dy * dpr;
                lastMousePos = { x: e.clientX, y: e.clientY };
                draw();
            }

            function zoom(e) {
                e.preventDefault();
                const dpr = window.devicePixelRatio || 1;
                const zoomFactor = 1.1;
                const mouseX = e.clientX - canvas.getBoundingClientRect().left;
                const mouseY = e.clientY - canvas.getBoundingClientRect().top;
                
                const worldBefore = screenToWorld(mouseX, mouseY);

                if (e.deltaY < 0) { // zoom in
                    transform.scale *= zoomFactor;
                } else { // zoom out
                    transform.scale /= zoomFactor;
                }

                const worldAfter = screenToWorld(mouseX, mouseY);

                transform.offsetX += (worldAfter.x - worldBefore.x) * transform.scale * dpr;
                transform.offsetY -= (worldAfter.y - worldBefore.y) * transform.scale * dpr;
                
                draw();
            }

            function updateCoords(e) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const worldCoords = screenToWorld(mouseX, mouseY);
                coordsDisplay.textContent = `x: ${worldCoords.x.toFixed(2)}, y: ${worldCoords.y.toFixed(2)}`;
            }


            // --- Drawing ---
            function draw() {
                if (!ctx) return;
                const dpr = window.devicePixelRatio || 1;
                const width = canvas.width / dpr;
                const height = canvas.height / dpr;

                // Clear canvas
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-color');
                ctx.fillRect(0, 0, width, height);
                
                ctx.save();
                ctx.translate(transform.centerX + transform.offsetX / dpr, transform.centerY + transform.offsetY / dpr);
                ctx.scale(transform.scale, -transform.scale);

                drawGridAndAxes();
                drawFunctions();
                
                ctx.restore();
            }
            
            function drawGridAndAxes() {
                const gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color');
                const axisColor = getComputedStyle(document.body).getPropertyValue('--axis-color');
                const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
                
                const worldTopLeft = screenToWorld(0, 0);
                const worldBottomRight = screenToWorld(canvas.clientWidth, canvas.clientHeight);

                const worldWidth = worldBottomRight.x - worldTopLeft.x;
                
                let step = 1;
                const minLines = 5;
                if (worldWidth / step > minLines * 2) {
                    while (worldWidth / step > minLines * 4) step *= 2;
                } else {
                    while (worldWidth / step < minLines) step /= 2;
                }
                
                ctx.lineWidth = 1 / transform.scale;

                // Grid lines
                ctx.strokeStyle = gridColor;
                ctx.beginPath();
                for (let x = Math.floor(worldTopLeft.x / step) * step; x <= worldBottomRight.x; x += step) {
                    ctx.moveTo(x, worldTopLeft.y);
                    ctx.lineTo(x, worldBottomRight.y);
                }
                for (let y = Math.floor(worldBottomRight.y / step) * step; y <= worldTopLeft.y; y += step) {
                    ctx.moveTo(worldTopLeft.x, y);
                    ctx.lineTo(worldBottomRight.x, y);
                }
                ctx.stroke();

                // Axes
                ctx.strokeStyle = axisColor;
                ctx.beginPath();
                ctx.moveTo(worldTopLeft.x, 0);
                ctx.lineTo(worldBottomRight.x, 0);
                ctx.moveTo(0, worldTopLeft.y);
                ctx.lineTo(0, worldBottomRight.y);
                ctx.stroke();

                // Axis labels
                ctx.fillStyle = textColor;
                ctx.font = `${12 / transform.scale}px Inter`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const labelPadding = 5 / transform.scale;
                
                for (let x = Math.floor(worldTopLeft.x / step) * step; x <= worldBottomRight.x; x += step) {
                    if (Math.abs(x) > 1e-9) { // Avoid drawing label at 0,0
                       ctx.save();
                       ctx.translate(x, -labelPadding);
                       ctx.scale(1, -1);
                       ctx.fillText(x.toPrecision(3), 0, 0);
                       ctx.restore();
                    }
                }

                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                for (let y = Math.floor(worldBottomRight.y / step) * step; y <= worldTopLeft.y; y += step) {
                     if (Math.abs(y) > 1e-9) {
                        ctx.save();
                        ctx.translate(labelPadding, y);
                        ctx.scale(1, -1);
                        ctx.fillText(y.toPrecision(3), 0, 0);
                        ctx.restore();
                    }
                }
            }

            function drawFunctions() {
                const dpr = window.devicePixelRatio || 1;
                const worldTopLeft = screenToWorld(0, 0);
                const worldBottomRight = screenToWorld(canvas.clientWidth, canvas.clientHeight);

                const stepX = (worldBottomRight.x - worldTopLeft.x) / (canvas.width / dpr);

                functions.forEach(func => {
                    if (!func.compiled) return;

                    ctx.strokeStyle = func.color;
                    ctx.lineWidth = 2 / transform.scale;
                    ctx.beginPath();
                    
                    let lastY = null;

                    for (let px = 0; px < canvas.width; px++) {
                        const x = worldTopLeft.x + px * stepX;
                        try {
                            const y = func.compiled.evaluate({ x: x });
                            if (typeof y === 'number' && isFinite(y)) {
                                if (lastY !== null && Math.abs(y - lastY) < (worldTopLeft.y - worldBottomRight.y)) {
                                    ctx.lineTo(x, y);
                                } else {
                                    ctx.moveTo(x, y);
                                }
                                lastY = y;
                            } else {
                                lastY = null;
                            }
                        } catch (e) {
                            lastY = null;
                        }
                    }
                    ctx.stroke();
                });
            }
            
            init();
        });