const express = require('express')
const fs = require('fs')
const fsp = fs.promises
const sharp = require('sharp')
const svgCaptcha = require('svg-captcha')
const md5 = require('md5')
const multer = require('multer')

const dbPromise = require('./db')
let db 
dbPromise.then(dbObject => {
  db = dbObject
})

const upload = multer({
  dest:'./upload',
  preservePath:true,
})


const app = express.Router()

let changePassToken = {}

//主页
app.get('/', (req, res, next) => {
  // console.log(req.cookies.user)//未签名的cookie
  // console.log(req.signedCookies.user)//已签名的cookie
  let user = req.signedCookies.user
  if(user) {
    res.render('index.pug', {
      user:user
    })
  }else {
      res.send(`
        <div>
          Welcome
          <a href='/register'>注册</a>
          <a href='/login'>登录</a>
        </div>
      `)
    }
})


//验证码
app.get('/captcha', (req, res, next) => {

  let captcha = svgCaptcha.create({ignoreChars: '0Oo1ilI',color: true})
  res.type('svg')
  req.session.captcha = captcha.text
  res.send(captcha.data)
})

//登录
app.route('/login')
  .get(async (req, res, next) => {
    let user = req.signedCookies.user
    if(user) res.redirect('/')
    res.send(`
    <div>
      <form action="/login" method="POST" class="loginForm">
        用户名: <input type="text" name="name"><br/>
        密码: <input type="password" name="pwd"><br/>
        验证码: <input type="text" name="captcha"><img src="/captcha" class="captchaImg"/><br/>
        <a href='/forgot'>忘记密码</a><br/>
        <button>登录</button>
      </form>
    </div>
    <script>
      let captchaImg = document.querySelector('.captchaImg')
      captchaImg.onclick = () => {
          captchaImg.src = '/captcha?' + Date.now()
      }

      let loginForm = document.querySelector('.loginForm')
      loginForm.addEventListener('submit', e => {
        let name = document.querySelector('[name="name"]').value
        let pwd = document.querySelector('[name="pwd"]').value
        let captcha = document.querySelector('[name="captcha"]').value
        e.preventDefault()
        let xhr = new XMLHttpRequest()
        xhr.open('POST', '/login')
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
        xhr.onload = () => {
          console.log(JSON.parse(xhr.responseText).code)
          if(JSON.parse(xhr.responseText).code == 1) {
            alert('login success')
            location.href='/'
          }else {
            alert('login failed')
            captchaImg.click()
          }
        }
        xhr.send('name='+ name +'&pwd='+ pwd + '&captcha=' + captcha)
      })
    </script>
    `)
  })
  .post(async (req, res, next) => {
    let tryUserInfo = req.body
    if(tryUserInfo.captcha != req.session.captcha) {
      res.json({code:-1})
      return
    }
    let user = await db.get('SELECT * FROM users WHERE name=? AND pwd=?', tryUserInfo.name, md5(tryUserInfo.pwd))
    console.log(user)
    if(user) {
      res.cookie('user', user, {
        signed:true,
        httpOnly: true,
      })
      res.json({code:1})
      return
      res.send(`
        登录成功，<span id="count">3</span>秒后跳转到首页...
        <script>
          let r = 3
          setInterval(() => {
            count.textContent = --r
          }, 1000)
          setTimeout(() => {
            location.href='/'
          }, 3000)
        </script>
      `)
    }else {
      res.json({code:-1})
    }
    res.end()
  })

//注册
app.route('/register')
  .get((req, res, next) => {
    res.send(`
    <div>
      <form action="/register" method="POST" enctype="multipart/form-data">
        用户名: <input type="text" name="name"><br/>
        邮箱: <input type="text" name="email"><br/>
        密码: <input type="password" name="pwd"><br/>
        头像: <input type="file" name="avatar"><br/>
        <button>注册</button>
      </form>
    </div>
    `)
  })
  .post(upload.single('avatar'), async (req, res, next) => {//ajax重写
    let regInfo = req.body
    console.log('avatar', req.file)
    //压缩头像
    let imgBuf = await fsp.readFile(req.file.path)
    await sharp(imgBuf)
    .resize(256)
    .toFile(req.file.path)
    
    console.log(imgBuf, req.file.filename)
    let user = await db.get('SELECT * FROM users WHERE name=?',regInfo.name)
    if(user) {
      res.send(`<h2>用户名已被占用</h2>
      <script>
        setTimeout(() => {
          location.href='/register'
        }, 1300)
      </script>
      `)
      // res.redirect('/register')
    }else if(await db.get('SELECT * FROM users WHERE email=?', regInfo.email)){
      res.send(`邮箱已注册
      <script>
        setTimeout(() => {
          location.href='/register'
        }, 1300)
      </script>
      `)
      // res.redirect('/register')
    }else {
      await db.run('INSERT INTO users (name, email, pwd, avatar) VALUES(?,?,?,?)', regInfo.name, regInfo.email, md5(regInfo.pwd), req.file.path)
      res.send(`注册成功
      <script>
        setTimeout(() => {
          location.href='/'
        }, 1300)
      </script>
      `)
      // res.redirect('/login')
    }
    res.end()
  })
//登出
app.get('/logout', (req, res, next) => {
  res.clearCookie('user')
  res.redirect('/')
})
//忘记密码
app.route('/forgot')
  .get((req, res, next) => {
    res.send(`
    请输入您注册时的邮箱：<br/>
    <form action='/forgot' method='POST' class="changePass">
      <input type='text' name="email">
      <button>确定</button>
    </form>
    <script>
      let changePass = document.querySelector('.changePass')
      changePass.addEventListener('submit', e => {
        let email = document.querySelector('[name="email"]').value
        e.preventDefault()
        let xhr = new XMLHttpRequest()
        xhr.open('POST', '/forgot')
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
        xhr.onload = () => {
          if(JSON.parse(xhr.responseText).email == 1) {
            alert('已向您的邮箱发送密码重置链接,请于20分钟内点击链接修改密码。')
            location.href='/'
          }else {
            alert('邮箱不存在')
          }
        }
        xhr.send('email='+ email)
      })
    </script>
    `)
  })
  .post(async(req, res, next) => {
    let email = req.body.email
    let user = await db.get('SELECT * FROM users WHERE email=?', email)
    if(user) {
      let token = Math.random().toString().slice(2)
      changePassToken[token] = email
      setTimeout(() => {
        delete changePassToken[token]
      }, 1000 * 60 * 20)
      let link = `http://localhost:9090/changePass/${token}`
      console.log(link)
      res.json({email:1})
      //邮件发送
      return
      mailer.sendMail({
        from: '401688138@qq.com',
        to: email,
        subject: '密码重置链接',
        text: '请点击链接重置密码: '+link,
      },(err, data) => {
        if(err) {
          console.log(err)
          res.redirect('/forgot')
        }else {
          res.json({email:1})
        }
      })
    }else {//ajax重写
      res.json({email:0})
    }
  })

app.route('/changePass/:token')
  .get(async (req, res, next) => {
    let token = req.params.token
    let user = await db.get('SELECT * FROM users WHERE email=?',changePassToken[token])
    if(user) {
      res.send(`
      此页面可以重置${user.name}的密码
      <form action="" method="POST">
        <input type="password" name="pwd">
        <button>确定</button>
      </form>
      `)
    }else {
      res.redirect('/')
    }
  })
  .post(async (req, res, next) => {
    let pwd = md5(req.body.pwd)
    let token = req.params.token
    let user = await db.get('SELECT * FROM users WHERE email=?',changePassToken[token])
    if(user) {
      await db.run('UPDATE users SET pwd=? where name=?', pwd, user.name)
      delete changePassToken[token]
      res.send(`密码重置成功
      <script>
        setTimeout(() => {
          location.href='/login'
        }, 1300)
      </script>
      `)
    }else {
      res.send(`此链接已失效
      <script>
        setTimeout(() => {
          location.href='/login'
        }, 1300)
      </script>
      `)
    }
  })

module.exports = app