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
  dest: './upload',
  preservePath: true,
})

const app = express.Router()

let changePassToken = {}

//验证码
app.get('/captcha', (req, res, next) => {
  let captcha = svgCaptcha.create({
    ignoreChars: '0Oo1ilI',
    color: true
  })
  res.type('svg')
  req.session.captcha = captcha.text
  res.send(captcha.data)
})

//用户信息
app.get('/userInfo', async (req, res, next) => {
  let userId = req.signedCookies.userId
  if (userId) {
    res.json({
      code: 1,
      user: await db.get('SELECT id,name,avatar FROM users WHERE id=?', userId)
    })
  } else {
    res.json({
      code: -1
    })
    res.status(404).end()
  }
})

app.route('/login')
  .post(async (req, res, next) => {
    let tryUserInfo = req.body

    // if(tryUserInfo.captcha != req.session.captcha) {//验证码错误
    //   res.json({code:-1,msg:'验证码错误'})
    //   return
    // }

    let user = await db.get('SELECT * FROM users WHERE name=? AND pwd=?', tryUserInfo.name, md5(tryUserInfo.pwd))
    console.log(user)
    if (user) {
      res.cookie('userId', user.id, {
        signed: true,
        httpOnly: true,
      })
      res.json({
        msg: '登录成功',
        code: 1
      })
      return
    } else {
      res.json({
        code: -1,
        msg: '用户名或密码错误'
      })
    }
    res.end()
  })

//注册
app.route('/register')
  .post(upload.single('avatar'), async (req, res, next) => { //ajax重写
    let reqInfo = req.body
    if(!req.file) {
      res.json({code:-1,msg:'未上传头像'})
    }
    // console.log(imgBuf, req.file.filename)
    let user = await db.get('SELECT * FROM users WHERE name=?', reqInfo.name)
    if (user) {
      await fsp.unlink(req.file.path)
      res.json({
        code: -1,
        msg: '用户已被占用'
      })
    } else if (await db.get('SELECT * FROM users WHERE email=?', reqInfo.email)) {
      await fsp.unlink(req.file.path)
      res.json({
        code: -1,
        msg: '邮箱已被注册'
      })

    } else {
      if(req.file) {
        //压缩头像
        let imgBuf = await fsp.readFile(req.file.path)
        await sharp(imgBuf)
          .resize(256)
          .toFile(req.file.path)
      }

      await db.run('INSERT INTO users (name, email, pwd, avatar) VALUES(?,?,?,?)', reqInfo.name, reqInfo.email, md5(reqInfo.pwd), req.file.path)
      res.json({
        code: 1,
        msg: '注册成功'
      })
    }
    res.end()
  })
//登出
app.get('/logout', (req, res, next) => {
  res.clearCookie('userId')
  res.end()
})
//忘记密码
app.route('/forgot')
  // .get((req, res, next) => {
  //   res.send(`
  //   请输入您注册时的邮箱：<br/>
  //   <form action='/forgot' method='POST' class="changePass">
  //     <input type='text' name="email">
  //     <button>确定</button>
  //   </form>
  //   <script>
  //     let changePass = document.querySelector('.changePass')
  //     changePass.addEventListener('submit', e => {
  //       let email = document.querySelector('[name="email"]').value
  //       e.preventDefault()
  //       let xhr = new XMLHttpRequest()
  //       xhr.open('POST', '/forgot')
  //       xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
  //       xhr.onload = () => {
  //         if(JSON.parse(xhr.responseText).email == 1) {
  //           alert('已向您的邮箱发送密码重置链接,请于20分钟内点击链接修改密码。')
  //           location.href='/'
  //         }else {
  //           alert('邮箱不存在')
  //         }
  //       }
  //       xhr.send('email='+ email)
  //     })
  //   </script>
  //   `)
  // })
  .post(async (req, res, next) => {
    console.log(req.body)
    let email = req.body.email
    let user = await db.get('SELECT * FROM users WHERE email=?', email)
    if (user) {
      let token = Math.random().toString().slice(2)
      changePassToken[token] = email
      setTimeout(() => {
        delete changePassToken[token]
      }, 1000 * 60 * 20)
      let link = `http://localhost:9090/#/changePass/${token}`
      console.log(link)
      // res.json({
      //   code: 1,
      //   msg: '已向您的邮箱发送密码重置链接，请于20分钟内点击链接修改密码'
      // })
      //邮件发送
      // return
      mailer.sendMail({
        from: '401688138@qq.com',
        to: email,
        subject: '密码重置链接',
        text: '请点击链接重置密码: ' + link,
      }, (err, data) => {
        if (err) {
          console.log(err)
          res.redirect('/forgot')
        } else {
          res.json({
            code: 1,
            msg: '已向您的邮箱发送密码重置链接，请于20分钟内点击链接修改密码'
          })
        }
      })
    } else { //ajax重写
      res.json({
        code: -1,
        msg: '用户不存在'
      })
    }
  })

app.route('/changePass/:token')
  .get(async (req, res, next) => {
    let token = req.params.token
    if(!token) {
      console.log('1')
      res.json({code:-1,msg:'链接已失效'}).end()
    }else {
      res.json({code:1}).end()
    }

  })
  .post(async (req, res, next) => {
    let token = req.params.token
    let pwd = md5(req.body.pwd)
    let user = await db.get('SELECT * FROM users WHERE email=?', changePassToken[token])
    if (user) {
      await db.run('UPDATE users SET pwd=? where name=?', pwd, user.name)
      delete changePassToken[token]
      res.json({
        code: 1,
        msg: '密码修改成功'
      })
    } else {
      res.json({
        code: -1,
        msg: '此链接已失效'
      })
    }
  })

module.exports = app