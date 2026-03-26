(() => {
  const GRID = 64; // 64x64 格
  const CELL_PX = 10; // 每格像素大小：640px = 64 * 10

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d", { alpha: false });

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const btnStart = document.getElementById("btnStart");

  const timeText = document.getElementById("timeText");
  const scoreText = document.getElementById("scoreText");
  const speedText = document.getElementById("speedText");

  // 狀態
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let foodEaten = 0;

  // 時間與加速
  let running = false;
  let startTimeMs = 0;
  let elapsedMs = 0;
  let stepAccumMs = 0;

  const baseIntervalMs = 130; // 初始移動間隔
  const minIntervalMs = 55; // 加速下限
  let targetIntervalMs = baseIntervalMs;
  let currentIntervalMs = baseIntervalMs;

  function keyToDir(key) {
    switch (key) {
      case "ArrowUp":
      case "w":
      case "W":
        return { x: 0, y: -1 };
      case "ArrowDown":
      case "s":
      case "S":
        return { x: 0, y: 1 };
      case "ArrowLeft":
      case "a":
      case "A":
        return { x: -1, y: 0 };
      case "ArrowRight":
      case "d":
      case "D":
        return { x: 1, y: 0 };
      default:
        return null;
    }
  }

  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function randInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function cellsEqual(p, q) {
    return p.x === q.x && p.y === q.y;
  }

  function placeFood() {
    // 隨機找一格不在蛇身上的位置
    // 若接近滿格，這裡會多次重試，但對 64x64 足夠快
    for (let tries = 0; tries < 5000; tries++) {
      const p = { x: randInt(GRID), y: randInt(GRID) };
      if (!snake.some((s) => cellsEqual(s, p))) {
        food = p;
        return;
      }
    }
    // 理論上不太會遇到：蛇填滿棋盤則直接不再放食物
    food = { x: -1, y: -1 };
  }

  function resetGame() {
    running = false;
    overlay.style.display = "none";

    snake = [];
    const startX = Math.floor(GRID * 0.25);
    const startY = Math.floor(GRID * 0.5);

    // 起始長度 3（尾巴更短）
    for (let i = 0; i < 3; i++) {
      snake.push({ x: startX - i, y: startY });
    }

    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };

    foodEaten = 0;
    targetIntervalMs = baseIntervalMs;
    currentIntervalMs = baseIntervalMs;
    stepAccumMs = 0;

    placeFood();
    startTimeMs = 0;
    elapsedMs = 0;

    updateHud(0);
    draw();
  }

  function setSpeedByScore() {
    // 每吃 5 個食物 -> 加速一部分
    const level = Math.floor(foodEaten / 5); // 0,1,2...
    // 使用遞減的間隔達成加速；越往後越快，但有下限
    targetIntervalMs = Math.max(minIntervalMs, baseIntervalMs / (1 + level * 0.25));
  }

  function updateHud(nowElapsedMs) {
    elapsedMs = nowElapsedMs;
    const seconds = elapsedMs / 1000;
    timeText.textContent = `${seconds.toFixed(2)} s`;
    scoreText.textContent = `${foodEaten} 個`;
    const speedMul = baseIntervalMs / currentIntervalMs; // 間隔越短，速度倍率越大
    speedText.textContent = `${speedMul.toFixed(2)}x`;
  }

  function gameOver() {
    running = false;

    // 精確計算結束時間（避免在 step() 呼叫時 HUD 還沒更新到）
    elapsedMs = startTimeMs ? performance.now() - startTimeMs : elapsedMs;
    updateHud(elapsedMs);

    const seconds = elapsedMs / 1000;
    overlayTitle.textContent = "遊戲結束";
    overlay.querySelector(".hint").innerHTML = `時間：<b>${seconds.toFixed(
      2
    )} 秒</b><br />成功吃到：<b>${foodEaten}</b> 個食物`;
    btnStart.textContent = "再玩一次";
    overlay.style.display = "flex";
  }

  function tryStart() {
    // 初次按下開始
    if (!running) {
      running = true;
      startTimeMs = performance.now();
      stepAccumMs = 0;

      btnStart.blur();
      // 確保 HUD 與速度目標一致
      setSpeedByScore();
      overlay.style.display = "none";
      requestAnimationFrame(loop);
    }
  }

  function step() {
    dir = nextDir;

    const head = snake[0];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // 撞邊界
    if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
      gameOver();
      return;
    }

    const willEat = cellsEqual(newHead, food);

    // 撞到自己：
    // 若本次不會吃到食物，tail 會被 pop() 移除，所以「移動後的新頭撞到尾巴」應視為不算撞到自己。
    const collisionBody = willEat ? snake : snake.slice(0, -1);
    if (collisionBody.some((s) => cellsEqual(s, newHead))) {
      gameOver();
      return;
    }

    snake.unshift(newHead);

    // 吃到食物
    if (cellsEqual(newHead, food)) {
      foodEaten++;
      setSpeedByScore();
      placeFood();
    } else {
      snake.pop();
    }
  }

  function drawCell(x, y, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
  }

  function draw() {
    // 背景
    ctx.fillStyle = "#000814";
    ctx.fillRect(0, 0, GRID * CELL_PX, GRID * CELL_PX);

    // 格線（淡淡的，讓 64x64 更像「格」）
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      const p = i * CELL_PX + 0.5; // 對齊像素
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, GRID * CELL_PX);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(GRID * CELL_PX, p);
      ctx.stroke();
    }

    // 食物
    if (food.x >= 0) {
      drawCell(food.x, food.y, getComputedStyle(document.documentElement).getPropertyValue("--food").trim() || "#fb7185");
    }

    // 蛇
    const snakeHeadColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--snakeHead")
      .trim();
    const snakeBodyColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--snake")
      .trim();

    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      if (i === 0) {
        drawCell(seg.x, seg.y, snakeHeadColor || "#34d399");
      } else {
        drawCell(seg.x, seg.y, snakeBodyColor || "#36d399");
      }
    }
  }

  let lastFrameMs = 0;
  function loop(nowMs) {
    if (!running) return;

    if (!lastFrameMs) lastFrameMs = nowMs;
    const deltaMs = nowMs - lastFrameMs;
    lastFrameMs = nowMs;

    // 平滑地追蹤目標速度，讓加速看起來更「逐漸」
    currentIntervalMs += (targetIntervalMs - currentIntervalMs) * 0.08;

    stepAccumMs += deltaMs;
    while (stepAccumMs >= currentIntervalMs) {
      stepAccumMs -= currentIntervalMs;
      step();
      if (!running) break;
    }

    elapsedMs = nowMs - startTimeMs;
    updateHud(elapsedMs);
    draw();

    requestAnimationFrame(loop);
  }

  // 鍵盤控制
  window.addEventListener("keydown", (e) => {
    const desired = keyToDir(e.key);
    if (!desired) return;

    // 避免滾動（箭頭鍵）
    e.preventDefault();

    // 不允許直接反向造成「立刻掉頭」
    if (isOpposite(desired, dir)) return;
    nextDir = desired;
  });

  btnStart.addEventListener("click", () => {
    if (overlayTitle.textContent === "遊戲結束") {
      // 再玩一次：重新初始化
      btnStart.textContent = "開始遊戲";
      overlayTitle.textContent = "準備開始";
      resetGame();
    }
    tryStart();
  });

  // 首次載入
  // 設定畫布尺寸（依 CELL_PX 會跟著調整）
  canvas.width = GRID * CELL_PX;
  canvas.height = GRID * CELL_PX;

  resetGame();
  // 開場畫面顯示
  overlay.style.display = "flex";
})();

