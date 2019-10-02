const express = require('express')
const cookieParser = require('cookie-parser')
const socket = require('socket.io')
const http = require('http')
const url = require('url')
const dbPromise = require('./db')
let db

const session = require('express-session')

// const port = 9090

const app = express()
// const server = http.createServer(app)
const httpsServer = https.createServer({
  key : fs.readFileSync('/root/.acme.sh/7.versionlin.com/7.versionlin.com.key'),
  cert : fs.readFileSync('/root/.acme.sh/7.versionlin.com/7.versionlin.com.cer')
},app)
// const ioServer = socket(server)
const ioServer = socket(httpsServer)

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
app.use(session({secret:'my secret', resave:false,saveUninitialized:false, cookie:{maxAge:60000}}))
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


//创建投票页面
app.post('/create-vote', async(req, res, next) => {
  let voteInfos = req.body
  let userid = req.signedCookies.user.id
  
  console.log(voteInfos)
  let lastItem = await db.run('INSERT INTO votes (title, desc, userid, singleSelect, deadline, anonymous) VALUES(?,?,?,?,?,?)',
    voteInfos.title, voteInfos.desc, userid, voteInfos.singleSelect, new Date(voteInfos.deadline).getTime(), voteInfos.anonymous
  )
  // let vote = await db.get('SELECT * FROM votes ORDER BY id DESC LIMIT 1')
  await Promise.all(voteInfos.options.map(option => {
    return db.run('INSERT INTO options (content, voteid) VALUES (?,?)',option,lastItem.lastID)
  }))
  res.redirect('/vote/' + vote.id)
})

//投票页面
app.get('/vote/:id', async (req, res, next) => {
  let voteid= req.params.id
  let user = req.signedCookies.user
  if(user) {
    let voted = db.get('SELECT * FROM voteups WHERE userid=? AND voteid=?', user.id, voteid)
    if(voted) {
      ioServer.on('connection', socket => {
        let path = url.parse(socket.request.headers.referer).path
        socket.join(path)
      })
    }
  }
  let votePromise = db.get('SELECT * FROM votes WHERE id=?', voteid)
  let optionsPromise = db.all('SELECT * FROM options WHERE voteid=?', voteid)
  
  let vote = await votePromise
  let options = await optionsPromise
  // console.log(vote)
  // console.log(options)
  res.render('vote.pug', {
    vote: vote,
    options: options,
  })
})
//投票响应
app.post('/voteup', async (req, res, next) => {
  let body =  req.body
  let user = req.signedCookies.user
  let voteid = body.voteid
  if(!user) return
  let voteupInfo = await db.get('SELECT * FROM voteups WHERE userid=? AND voteid=?', user.id, body.voteid)
  if(voteupInfo) {
    return res.end()
    // await db.run('UPDATE voteups SET optionid=? WHERE userid=? AND voteid=?', body.optionid, user.id, body.voteid)
  }else {
    await db.run('INSERT INTO voteups (userid, optionid, voteid) VALUES (?,?,?)', user.id, body.optionid, body.voteid)
    let voteups = await db.all('SELECT * FROM voteups WHERE voteid=?', body.voteid)
    ioServer.in(`/vote/${voteid}`).emit('new vote', {
      data:voteups,
    })
  }
  let voteups = await db.all('SELECT * FROM voteups WHERE voteid=?', body.voteid)
  res.json(voteups)
})

//投票结果响应
app.get('/voteup/:voteid/info', async(req, res, next) => {
  let user = req.signedCookies.user
  if(!user) return
  let voteid = req.params.voteid

  let userVoteupInfo = await db.get('SELECT * FROM voteups WHERE userid=? AND voteid=?', user.id, voteid)
  if(userVoteupInfo) {
    let voteups = await db.all('SELECT * FROM voteups WHERE voteid=?', voteid)
    res.json(voteups)
  }else {
    res.json(null)
  }
})

app.use('/', userAccountRouter)

dbPromise.then(dbObject => {
  db = dbObject
  // server.listen(port, () => {
  //   console.log('server listen port' + port)
  // })
  httpsServer.listen(443, () => {
    console.log('listen 443')
  })
})
