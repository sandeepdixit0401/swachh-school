# 🌿 स्वच्छ स्कूल - Netlify Version

## ⚠️ Important: Deploy kaise karein

**Drag & Drop se Functions kaam NAHI karti.**  
Isliye GitHub se deploy karna zaroori hai.

---

### Method 1: GitHub se (Recommended - Reliable)

1. Is ZIP ko extract karo
2. [GitHub](https://github.com/new) pe naya Public repo banao (name: `swachh-school`)
3. Saari files (folders ke saath) GitHub pe upload kar do
4. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
5. GitHub choose karo → apna repo select karo
6. Settings:
   - **Build command**: khali chhod do
   - **Publish directory**: `public`
7. **Deploy site** click karo

Deploy hone ke baad site ready ho jayegi.

---

### Method 2: Netlify CLI (agar GitHub nahi chahte)

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=public --functions=netlify/functions
```

---

## Use kaise karein

- **Students**: Site kholo → "रिपोर्ट करें" → photo bhejo
- **Admin**: `/admin.html` kholo  
  **Password:** `admin123`

---

**Note:** Pehli baar deploy ke baad Functions start hone mein 30-60 seconds lag sakte hain.
