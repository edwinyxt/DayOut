import express from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';

const SALT = 'lets hang out';
const {Pool} = pg;
const pgConnectionConfigs = {
  user: 'edwinyxt',
  host: 'localhost',
  database: 'dayout',
  port: 5432, // Postgres server always runs on this port by default
};
const pool = new Pool(pgConnectionConfigs);

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));
app.use(methodOverride('_method'));
app.use(cookieParser());

app.get('/signup', (req, res) => {
  const {loggedIn} = req.cookies;
  res.render('sign-up', {loggedIn});
});

app.post('/signup', (req, res) => {
  const shaObj = new jsSHA('SHA-512', 'TEXT', {encoding: 'UTF8'});

  shaObj.update(req.body.password);

  const hashedPassword = shaObj.getHash('HEX');

  const newUserQuery = 'INSERT INTO users (email, username, password) VALUES ($1, $2, $3)';
  const inputData = [req.body.email, req.body.username, hashedPassword];

  pool.query(newUserQuery, inputData, (newUserQueryError, newUserQueryResult) => {
    if (newUserQueryError) {
      console.log('error', newUserQueryError);
    } else {
      console.log(newUserQueryResult.rows);

      res.redirect('/login');
    }
  });
});

app.get('/login', (req, res) => {
  const {loggedIn} = req.cookies;
  res.render('login', {loggedIn});
});

app.post('/login', (req, res) => {
  pool.query(`SELECT * FROM users WHERE email = '${req.body.email}'`, (emailQueryError, emailQueryResult) => {
    if (emailQueryError) {
      console.log('error', emailQueryError);
      res.status(503).send('request not successful');
      return;
    }

    if (emailQueryResult.rows.length === 0) {
      res.status(403).send('not successful');
      return;
    }

    console.log('password', emailQueryResult.rows[0].password);

    const shaObj = new jsSHA('SHA-512', 'TEXT', {encoding: 'UTF8'});
    shaObj.update(req.body.password);
    const hashedPassword = shaObj.getHash('HEX');
    console.log(hashedPassword);
    if (emailQueryResult.rows[0].password === hashedPassword) {
      res.cookie('loggedIn', true);

      const shaObj1 = new jsSHA('SHA-512', 'TEXT', {encoding: 'UTF8'});
      const unhashedCookieString = `${emailQueryResult.rows[0].id}-${SALT}`;
      shaObj1.update(unhashedCookieString);
      const hashedCookieString = shaObj1.getHash('HEX');
      res.cookie('loggedInHash', hashedCookieString);
      res.cookie('userId', emailQueryResult.rows[0].id);
      res.redirect('/groups');
      // res.send('login success!');
    } else {
      res.status(403).send('not successful');
    }
  });
});

app.delete('/logout', (req, res) => {
  res.clearCookie('loggedIn');
  res.clearCookie('userId');
  res.clearCookie('loggedInHash');
  res.redirect('/login');
});

app.get('/groups', (req, res) => {
  const {loggedIn, userId} = req.cookies;
  if (!loggedIn) {
    res.render('login', {loggedIn});
  } else {
    const groupsQuery = `select * from groups INNER JOIN users_groups ON groups.id = users_groups.group_id WHERE users_groups.user_id = ${userId}`;
    pool.query(groupsQuery, (groupsQueryError, groupsQueryResult) => {
      if (groupsQueryError) {
        console.log('error', groupsQueryError);
      } else {
        console.log(groupsQueryResult.rows);
        const allGroups = groupsQueryResult.rows;

        const userNameQuery = `select username from users where id = ${userId}`;

        pool.query(userNameQuery, (userNameQueryError, userNameQueryResult) => {
          if (userNameQueryError) {
            console.log('error', userNameQueryError);
          } else {
            const userNameResult = userNameQueryResult.rows[0];
            res.render('groups-landing', {allGroups, userNameResult});
          }
        });
      }
    });
  };
});

app.post('/create-group', (req, res) => {
  const groupData = req.body;
  const inputData = [groupData.name, groupData.description];

  pool
      .query('INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING id', inputData)

      .then((result) => {
        const groupId = result.rows[0].id;
        const userData = [Number(req.cookies.userId), groupId];

        return pool.query(
            'INSERT INTO users_groups (user_id, group_id) VALUES ($1, $2) RETURNING *', userData,

        );
      })
      .then((result) => {
        console.log(result.rows);
      })
      .catch((error) => console.log(error.stack));
  res.redirect('/groups');
});

app.post('/create-idea/:id', (req, res) => {
  const groupId = Number(req.params.id);
  const ideaData = req.body;
  const inputData = [Number(req.cookies.userId), groupId, ideaData.description, ideaData.link, ideaData.location, ideaData.sdate, ideaData.edate];

  console.log(inputData);

  pool
      .query('INSERT INTO events_repository (user_id, group_id, description, link, location, start_date, end_date) VALUES ($1, $2, $3,$4,$5,$6,$7) RETURNING id', inputData).then((result) => {
        console.log(result.rows);
      }).catch((error) => console.log(error.stack));

  res.redirect(`/group/${groupId}/ideas`);
}),

app.get('/group/:id', (req, res) => {
  // const {id} = req.params;
  const groupId = Number(req.params.id);
  const groupQuery = `SELECT * from groups where id = ${groupId}`;
  pool.query(groupQuery, (groupQueryError, groupQueryResult)=>{
    if (groupQueryError) {
      console.log('error', groupQueryError);
    } else {
      const groupDetails = groupQueryResult.rows[0];
      console.log('groupDetails', groupDetails);
      res.render('single-group-home', {groupDetails});
    }
  });
});

app.get('/group/:id/members', (req, res) => {
  // const {loggedIn} = req.cookies;

  const groupId = Number(req.params.id);
  const groupDetails = {};
  groupDetails.id = groupId;

  const membersQuery = `select * from users INNER JOIN users_groups ON users.id = users_groups.user_id WHERE users_groups.group_id = ${groupId}`;
  pool.query(membersQuery, (membersQueryError, membersQueryResult) => {
    if (membersQueryError) {
      console.log('error', membersQueryError);
    } else {
      console.log(membersQueryResult.rows);
      const members = membersQueryResult.rows;
      const {loggedIn} = req.cookies;
      console.log('logged in?', loggedIn);
      res.render('group-members', {members, groupDetails, loggedIn});
    }
  });


  // res.render('group-members', {loggedIn});
});

app.get('/group/:id/ideas', (req, res) => {
  const groupId = Number(req.params.id);
  const groupDetails = {};
  groupDetails.id = groupId;

  const ideasQuery = `select * from events_repository where group_id=${groupId}`;
  pool.query(ideasQuery, (ideasQueryError, ideasQueryResult) => {
    if (ideasQueryError) {
      console.log('error', ideasQueryError);
    } else {
      console.log(ideasQueryResult.rows);
      const allIdeas = ideasQueryResult.rows;
      const {loggedIn} = req.cookies;
      console.log('logged in?', loggedIn);
      res.render('ideas', {allIdeas, groupDetails, loggedIn});
    }
  });

  // res.render('ideas', {groupDetails});
});
app.get('/group/:id/trips', (req, res) => {
  const groupId = Number(req.params.id);
  const groupDetails = {};
  groupDetails.id = groupId;
  const {loggedIn} = req.cookies;
  res.render('planned-trips', {loggedIn, groupDetails});


  // const ideasQuery = `select * from events_repository where group_id=${groupId}`;
  // pool.query(ideasQuery, (ideasQueryError, ideasQueryResult) => {
  //   if (ideasQueryError) {
  //     console.log('error', ideasQueryError);
  //   } else {
  //     console.log(ideasQueryResult.rows);
  //     const allIdeas = ideasQueryResult.rows;
  //     const {loggedIn} = req.cookies;
  //     console.log('logged in?', loggedIn);
  //     res.render('ideas', {allIdeas, groupDetails, loggedIn});
  //   }
  // });
} );
app.get('/group/:id/trip/:date', (req, res) => {} );
app.get('/group/:id/archive', (req, res) => {} );

app.listen(3004);
