const express = require('express')
const cookieParser = require('cookie-parser')
const http = require('http')
const socketIO = require('socket.io')
const cors = require('cors')
// const https = require('https')

// const fs = require('fs')
const session = require('express-session')

const app = express()
const server = http.createServer(app)

const port = 9090

const ioServer = socketIO(server)
//global.ioServer = ioServer

// const httpsServer = https.createServer({
//   key : fs.readFileSync('/root/.acme.sh/7.versionlin.com/7.versionlin.com.key'),
//   cert : fs.readFileSync('/root/.acme.sh/7.versionlin.com/7.versionlin.com.cer')
// },app)

app.use(cors({
  maxAge:86400,
  credentials:true,
  //origin: http:/xxxxx/
  origin: function(origin,cb) {
    cb(null,true)
  }
}))

// const ioServer = socket(httpsServer)

// app.set('views', __dirname + '/tpl')//默认
// app.set('view engine', 'pug')
// app.locals.pretty = true//格式化pug输出代码

app.use(express.static(__dirname + '/static'))
app.use('/upload', express.static(__dirname + '/upload'))


app.use(express.json())//解析json请求体的中间件

app.use(express.urlencoded({//解析url编码的中间件
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

const voteInfo = require('./vote')
const userAccountRouter = require('./user-account')

app.use('/api',userAccountRouter)
app.use('/api',voteInfo(ioServer))

server.listen(port, () => {
  console.log('server listen port' + port)
})
// httpsServer.listen(443, () => {
//   console.log('listen 443')
// })
