const express = require('express')
const cookieParser = require('cookie-parser')
const mailer = require('./mailer')
const app = express()
const sqlite = require('sqlite')
const port = 9090

const dbPromise = sqlite.open(__dirname + '/db/vote.sqlite3')
let db

let changePassToken = {}

app.use(express.static(__dirname + './static'))

app.use(cookieParser('v2ray'))

app.use(express.urlencoded({
  extended : true,
}))

app.get('/', (req, res, next) => {
  console.log(req.cookies.user)
  console.log(req.signedCookies.user)
  if(req.signedCookies.user) {
    res.send(`
    <div>
        <span>Welcome, ${req.signedCookies.user}</span><br/>
        <a href="/create">创建投票</a><br/>
        <a href="/logout">登出</a>
    </div>
    `)
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

app.get('create', (req, res, next) => {

})

app.get('/vote/:id', (req, res, next) => {

})

//登录
app.route('/login')
  .get((req, res, next) => {
    if(req.signedCookies.user) res.redirect('/')
    res.send(`
    <div>
      <form action="/login" method="POST" class="loginForm">
        用户名: <input type="text" name="name"><br/>
        密码: <input type="password" name="pwd"><br/>
        <a href='/forgot'>忘记密码</a><br/>
        <button>登录</button>
      </form>
    </div>
    <script>
      let loginForm = document.querySelector('.loginForm')
      loginForm.addEventListener('submit', e => {
        let name = document.querySelector('[name="name"]').value
        let pwd = document.querySelector('[name="pwd"]').value
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
          }
        }
        xhr.send('name='+ name +'&pwd='+ pwd)
      })
    </script>
    `)
  })
  .post((req, res, next) => {
    let tryUserInfo = req.body
    if(users.some((it) => {return it.name == tryUserInfo.name && it.pwd == tryUserInfo.pwd})) {
      res.cookie('user', tryUserInfo.name, {
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
      <form action="/register" method="POST">
        用户名: <input type="text" name="name"><br/>
        邮箱: <input type="text" name="email"><br/>
        密码: <input type="password" name="pwd"><br/>
        <button>注册</button>
      </form>
    </div>
    `)
  })
  .post((req, res, next) => {//ajax重写
    let userInfo = req.body
    if(users.some((it) => {return it.name == userInfo.name})) {
      res.send(`<h2>用户名已被占用</h2>`)
      // res.redirect('/register')
    }else if(users.some((it) => {return it.email == userInfo.email})){
      res.send(`邮箱已注册`)
      // res.redirect('/register')
    }else {
      users.push(userInfo)
      console.log(users)
      res.redirect('/login')
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
            alert('已向您的邮箱发送密码重置链接')
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
  .post((req, res, next) => {
    let email = req.body.email
    if(users.some((it) => {return it.email == email})) {
      let token = Math.random().toString().slice(2)
      changePassToken[token] = email
      setTimeout(() => {
        delete changePassToken[token]
      }, 1000 * 60 * 10)
      let link = `http://localhost:9090/changePass/${token}`
      console.log(link)
      // res.json({email:1})
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
  .get((req, res, next) => {
    let token = req.params.token
    let user = users.find((it)=> {return it.email == changePassToken[token]})
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
  .post((req, res, next) => {
    let token = req.params.token
    let user = users.find((it)=> {return it.email == changePassToken[token]})
    if(user) {
      console.log(req.body.pwd)
      user.pwd  = req.body.pwd
      delete changePassToken[token]
      res.send(`密码重置成功`)
    }else {
      res.send(`此链接已失效`)
    }
  })

dbPromise.then(dbObject => {
  db = dbObject
  app.listen(port, () => {
    console.log('server listen port' + port)
  })
})