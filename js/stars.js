  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let w, h, stars, shooting = [];

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight * Math.max(3.2, document.body.scrollHeight / window.innerHeight);
    initStars();
  }

  function initStars(){
    stars = [];
    const count = Math.floor((w*h)/9000);
    for(let i=0;i<count;i++){
      stars.push({
        x: Math.random()*w,
        y: Math.random()*h,
        r: Math.random()*1.3 + 0.2,
        a: Math.random(),
        speed: Math.random()*0.015 + 0.003,
        gold: Math.random() < 0.12
      });
    }
  }

  function maybeSpawnShootingStar(){
    if(Math.random() < 0.004 && shooting.length < 2){
      const startX = Math.random()*w*0.6 + w*0.1;
      const startY = Math.random()*h*0.3;
      shooting.push({x:startX, y:startY, len: Math.random()*80+60, speed: Math.random()*8+9, life:1});
    }
  }

  function draw(){
    ctx.clearRect(0,0,w,h);
    for(const s of stars){
      s.a += s.speed;
      const twinkle = (Math.sin(s.a*Math.PI*2)+1)/2;
      const alpha = 0.15 + twinkle*0.85;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = s.gold ? `rgba(242,194,48,${alpha})` : `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }

    maybeSpawnShootingStar();
    shooting.forEach(st => {
      const grad = ctx.createLinearGradient(st.x, st.y, st.x - st.len, st.y - st.len*0.4);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x - st.len, st.y - st.len*0.4);
      ctx.stroke();
      st.x += st.speed;
      st.y += st.speed*0.4;
      st.life -= 0.012;
    });
    shooting = shooting.filter(st => st.life > 0 && st.x < w+100);

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
