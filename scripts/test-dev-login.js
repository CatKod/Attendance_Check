// Test login cho Trưởng Lab qua dev server
(async () => {
  const res = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '20232276@apes.edu.vn', password: '20232276' }),
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text.slice(0, 500));
})();