const express = require('express')
const cookieParser = require('cookie-parser')
const http = require('http')
const socket = require('socket.io')

// const https = require('https')

// const fs = require('fs')
const dbPromise = require('./db')
let db

const session = require('express-session')

const port = 9090

const app = express()
const server = http.createServer(app)

const ioServer = socket(server)
// const httpsServer = https.createServer({
//   key : fs.readFileSync('/root/.acme.sh/7.versionlin.com/7.versionlin.com.key'),
//   cert : fs.readFileSync('/root/.acme.sh/7.versionlin.com/7.versionlin.com.cer')
// },app)

// const ioServer = socket(httpsServer)
const voteInfo = require('./vote')
const userAccountRouter = require('./user-account')

app.set('views', __dirname + '/tpl')//默认
// app.set('view engine', 'pug')
app.locals.pretty = true//格式化pug输出代码

app.use(express.static(__dirname + '/static'))
app.use('/upload', express.static(__dirname + '/upload'))

//解析json请求体的中间件
app.use(express.json())
//解析url编码的中间件
app.use(express.urlencoded({
  extended : true,
}))

//express-session必须放在cookieParser前不然解析不出session
app.use(session({
  secret:'my secret', 
  resave:false,
  saveUninitialized:false, 
  cookie:{
    maxAge:60000
  }
}))
//且两者secret设置为相同
app.use(cookieParser('my secret'))

// let sessions = {}
// app.use(function session(req, res, next) {
//   let sessionId = req.cookies.sessionId
//   if(!sessionId) {
//     sessionId = Math.random().toString(16).slice(2)
//     res.cookie('sessionId', sessionId)
//   }
//   if(!sessions[sessionId]) {
//     sessions[sessionId] = {}
//   }
//   req.session = sessions[sessionId]
//   next()
// })

app.use('/', userAccountRouter)
app.use('/', voteInfo(ioServer))

dbPromise.then(dbObject => {
  db = dbObject
  server.listen(port, () => {
    console.log('server listen port' + port)
  })
  // httpsServer.listen(443, () => {
  //   console.log('listen 443')
  // })
})
