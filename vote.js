const express = require('express')
const app = express.Router()

const url = require('url')

// const http = require('http')
// const socket = require('socket.io')
// const server = http.createServer(app)
// const ioServer = socket(server)

const dbPromise = require('./db')
let db 
dbPromise.then(dbObject => {
  db = dbObject
})

let ioServer
// module.exports = app
module.exports = function (ioServerTmp) {
  ioServer = ioServerTmp
  return app
}

//创建投票页面
app.post('/vote', async(req, res, next) => {
  let voteInfos = req.body
  let userId = req.signedCookies.userId

  let info = await db.get('SELECT * FROM votes WHERE title=? AND desc=? AND userid=? AND singleSelect=? AND deadline=? AND anonymous=?', 
    voteInfos.title, voteInfos.desc, userId, voteInfos.singleSelect, new Date(voteInfos.deadline).getTime(), voteInfos.anonymous
  )
  if(info) {
    res.json({
      id:info.id,
      info,
      code:-1,
      msg:'投票已创建'
    })//投票已创建
    return
  }
    let lastItem = await db.run('INSERT INTO votes (title, desc, userid, singleSelect, deadline, anonymous) VALUES(?,?,?,?,?,?)',
    voteInfos.title, voteInfos.desc, userId, voteInfos.singleSelect, new Date(voteInfos.deadline).getTime(), voteInfos.anonymous
  )
  // let vote = await db.get('SELECT * FROM votes ORDER BY id DESC LIMIT 1')
  console.log(lastItem)
  await Promise.all(voteInfos.options.map(option => {
    return db.run('INSERT INTO options (content, voteid) VALUES (?,?)',option,lastItem.lastID)
  }))

  // if(req.is('json')) {
    res.json({
      id:lastItem.lastID,
      info: lastItem[0],
      code:1,
      msg:'创建成功'
    })
  // }else {
  //   res.redirect('/vote/' + lastItem.lastID)
  // }
})

//投票信息
app.get('/vote/:id', async (req, res, next) => {
  let voteid= req.params.id
  let userId = req.signedCookies.userId
  if(userId) {
    let vote = await db.get('SELECT * FROM voteups WHERE userid=? AND voteid=?', userId, voteid)
    if(vote) {
      let votePromise = db.get('SELECT * FROM votes WHERE id=?', voteid)
      let optionsPromise = db.all('SELECT * FROM options WHERE voteid=?', voteid)
      let voteups = await db.all('SELECT avatar,userid,name,optionid,voteid FROM voteups JOIN users ON voteups.userid=users.id WHERE voteid=?', voteid)
      let voteInfo = await votePromise
      let options = await optionsPromise
      ioServer.on('connection', socket => {
        let path = url.parse(socket.request.headers.referer).path
        socket.join(path)
      })
      res.json({
        code:1,
        voteInfo,
        options,
        voteups,
      })
      return
    }
  }
  let votePromise = db.get('SELECT * FROM votes WHERE id=?', voteid)
  let optionsPromise = db.all('SELECT * FROM options WHERE voteid=?', voteid)
  
  let voteInfo = await votePromise
  let options = await optionsPromise
  res.json({
    code:0,
    voteInfo,
    options,
  })

  // res.render('vote.pug', {
  //   vote,
  //   options,
  // })
})

//投票响应
app.post('/voteup', async (req, res, next) => {
  let body =  req.body
  let userId = req.signedCookies.userId
  let voteid = body.voteid
  if(!userId) return
  let voteupInfo = await db.get('SELECT * FROM voteups WHERE userid=? AND voteid=?', userId, body.voteid)
  if(voteupInfo) {
    res.json({
      code: 2,
      msg:''
    })
    return
    // await db.run('UPDATE voteups SET optionid=? WHERE userid=? AND voteid=?', body.optionid, user.id, body.voteid)
  }else {
    await db.run('INSERT INTO voteups (userid, optionid, voteid) VALUES (?,?,?)', userId, body.optionid, body.voteid)
    let voteups = await db.all('SELECT avatar,userid,name,optionid,voteid FROM voteups JOIN users ON voteups.userid=users.id WHERE voteid=?', body.voteid)
    ioServer.in(`/vote/${voteid}`).emit('new vote', {voteups})
  }
  let voteups = await db.all('SELECT avatar,userid,name,optionid,voteid FROM voteups JOIN users ON voteups.userid=users.id WHERE voteid=?', body.voteid)
  res.json({
    voteups,
    code:1,
    msg:''
  })
})

//投票结果响应
// app.get('/voteup/:voteid/info', async(req, res, next) => {
//   let user = req.signedCookies.user
//   if(!user) {
//     return res.end()
//   }//未登录
//   let voteid = req.params.voteid

//   let userVoteupInfo = await db.get('SELECT * FROM voteups WHERE userid=? AND voteid=?', user.id, voteid)
//   if(userVoteupInfo) {
//     let voteups = await db.all('SELECT * FROM voteups WHERE voteid=?', voteid)
//     res.json({
//       voteups,
//       code:1
//     })
//   }else {
//     res.json({
//       code:0
//     })//未投票
//   }
// })

