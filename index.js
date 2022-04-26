import express from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';
const PORT = process.env.PORT || 3004;
const SALT = 'lets hang out';
const {Pool} = pg;

let pgConnectionConfigs;
if (process.env.DATABASE_URL) {
  // pg will take in the entire value and use it to connect
  pgConnectionConfigs = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  };
} else {
  pgConnectionConfigs = {
    user: 'edwinyxt',
    host: 'localhost',
    database: 'dayout',
    port: 5432, // Postgres server always runs on this port by default
  };
}

// const pgConnectionConfigs = {
//   user: 'edwinyxt',
//   host: 'localhost',
//   database: 'dayout',
//   port: 5432, // Postgres server always runs on this port by default
// };
const pool = new Pool(pgConnectionConfigs);

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));
app.use(methodOverride('_method'));
app.use(cookieParser());

const getHash = (input) => {
  // create new SHA object
  const shaObj = new jsSHA('SHA-512', 'TEXT', {encoding: 'UTF8'});

  // create an unhashed cookie string based on user ID and salt
  const unhashedString = `${input}-${SALT}`;

  // generate a hashed cookie string using SHA object
  shaObj.update(unhashedString);

  return shaObj.getHash('HEX');
};

const checkAuth = (req, res, next) => {
  req.isUserLoggedIn = false;

  // check to see if the cookies you need exists
  if (req.cookies.loggedIn && req.cookies.userId) {
    // get the hased value that should be inside the cookie
    const hash = getHash(req.cookies.userId);

    // test the value of the cookie
    if (req.cookies.loggedInHash === hash) {
      req.isUserLoggedIn = true;
      const userNameQuery = `select username from users where id = ${req.cookies.userId}`;
      pool.query(userNameQuery, (userNameQueryError, userNameQueryResult) => {
        if (userNameQueryError) {
          console.log('error', userNameQueryError);
        } else {
          const userNameResult = userNameQueryResult.rows[0];
          app.locals.username = userNameResult.username;
          app.locals.userid = Number(req.cookies.userId);
          next();
        }
      });
    } else {
      next();
    }
  } else {
    next();
  }
};

const groupAuth = (req, res, next) => {
  const groupId = Number(req.params.id);
  const groupQuery = `SELECT * from groups where id = ${groupId}`;
  pool.query(groupQuery, (groupQueryError, groupQueryResult)=>{
    if (groupQueryError) {
      console.log('error', groupQueryError);
    } else {
      const groupDetails = groupQueryResult.rows[0];
      console.log('groupDetails', groupDetails);
      app.locals.groupname = groupDetails.name;
      next();
    }
  });
};

app.get('/', (req, res) => {
  res.redirect('/groups');
});

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

app.get('/groups', checkAuth, (req, res) => {
  const {userId} = req.cookies;
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const groupsQuery = `select * from groups INNER JOIN users_groups ON groups.id = users_groups.group_id WHERE users_groups.user_id = ${userId}`;
    pool.query(groupsQuery, (groupsQueryError, groupsQueryResult) => {
      if (groupsQueryError) {
        console.log('error', groupsQueryError);
      } else {
        console.log(groupsQueryResult.rows);
        const allGroups = groupsQueryResult.rows;
        res.render('groups-landing', {allGroups});
      }
    });
  };
});

app.get('/user-profile', checkAuth, (req, res) => {
  const {userId} = req.cookies;
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const userQuery = `select * from users where id= ${userId}`;
    pool.query(userQuery, (userQueryError, userQueryResult) => {
      if (userQueryError) {
        console.log('error', userQueryError);
      } else {
        console.log(userQueryResult.rows);
        const userProfile = userQueryResult.rows[0];
        res.render('user-profile', {userProfile});
      }
    });
  };
});

app.put('/user-profile/:userid/edit', (req, res) => {
  const userId = Number(req.params.userid);
  const userData = req.body;
  // const inputData = [userData.email, userData.username, userData.interests];
  // console.log(userId, inputData);

  pool
      .query(`UPDATE users SET email = '${userData.email}' , username = '${userData.username}' , interests = '${userData.interests}' where id = ${userId}`)

      .then((result) => {
        console.log(result.rows);
        res.redirect(`/groups`);
      }).catch((error) => console.log(error.stack));
});

app.post('/create-group', (req, res) => {
  const groupData = req.body;
  const inputData = [groupData.name, groupData.description];

  pool
      .query('INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING id', inputData)

      .then((result) => {
        const groupId = result.rows[0].id;
        const userData = [Number(req.cookies.userId), groupId, 't'];

        return pool.query(
            'INSERT INTO users_groups (user_id, group_id, user_is_admin) VALUES ($1, $2, $3) RETURNING *', userData);
      })
      .then((result) => {
        console.log(result.rows);
        res.redirect('/groups');
      })
      .catch((error) => console.log(error.stack));
});

app.get('/group/:id', checkAuth, groupAuth, (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const groupId = Number(req.params.id);
    const groupDetails = {};
    groupDetails.id = groupId;
    res.render('single-group-home', {groupDetails});
    //
    // const groupQuery = `SELECT * from groups where id = ${groupId}`;
    // pool.query(groupQuery, (groupQueryError, groupQueryResult)=>{
    //   if (groupQueryError) {
    //     console.log('error', groupQueryError);
    //   } else {
    //     const groupDetails = groupQueryResult.rows[0];
    //     console.log('groupDetails', groupDetails);

    //   }
    // });
  }
});

app.get('/group/:id/members', checkAuth, groupAuth, (req, res) => {
  // const {loggedIn} = req.cookies;
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const groupId = Number(req.params.id);
    const groupDetails = {};
    groupDetails.id = groupId;

    const membersQuery = `select * from users INNER JOIN users_groups ON users.id = users_groups.user_id WHERE users_groups.group_id = ${groupId} ORDER BY username asc`;

    const nonMembersQuery = `select email,lower(username) as username from users except select email,username from users INNER JOIN users_groups ON users.id = users_groups.user_id WHERE users_groups.group_id = ${groupId} ORDER by username asc`;

    const results = Promise.all([
      pool.query(membersQuery),
      pool.query(nonMembersQuery),
    ]);

    results.then((allResults) => {
      const [membersQueryResult, nonMembersQueryResult] = allResults;

      const members = membersQueryResult.rows;
      const nonMembers = nonMembersQueryResult.rows;

      res.render('group-members', {members, nonMembers, groupDetails});
    } );


    // pool.query(membersQuery, (membersQueryError, membersQueryResult) => {
    //   if (membersQueryError) {
    //     console.log('error', membersQueryError);
    //   } else {
    //     console.log(membersQueryResult.rows);
    //     const members = membersQueryResult.rows;
    //     // const {loggedIn} = req.cookies;
    //     // console.log('logged in?', loggedIn);
    //     res.render('group-members', {members, groupDetails});
    //   }
    // });
  }

  // res.render('group-members', {loggedIn});
});

app.get('/group/:id/profile', checkAuth, groupAuth, (req, res) => {
  // const {loggedIn} = req.cookies;
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const groupId = Number(req.params.id);
    const groupDetails = {};
    groupDetails.id = groupId;

    const membersQuery = `select * from users INNER JOIN users_groups ON users.id = users_groups.user_id WHERE users_groups.group_id = ${groupId}`;

    const nonMembersQuery = `select email,username from users except select email,username from users INNER JOIN users_groups ON users.id = users_groups.user_id WHERE users_groups.group_id = ${groupId};`;

    const results = Promise.all([
      pool.query(membersQuery),
      pool.query(nonMembersQuery),
    ]);

    results.then((allResults) => {
      const [membersQueryResult, nonMembersQueryResult] = allResults;

      const members = membersQueryResult.rows;
      const nonMembers = nonMembersQueryResult.rows;

      res.render('group-profile', {members, nonMembers, groupDetails});
    } );
  }
});

app.post('/add-member/:id', (req, res) => {
  const groupId = Number(req.params.id);
  const newMemberData = req.body;
  const newMemberEmail = newMemberData.non_member_email;

  console.log(newMemberEmail, 'newMemberEmail');

  pool
      .query(`select id from users where email = '${newMemberEmail}'`)

      .then((result) => {
        const newMemberId = result.rows[0].id;

        const inputData = [newMemberId, groupId];
        console.log(inputData, 'inputData');

        return pool. query(
            'INSERT INTO users_groups (user_id, group_id) VALUES ($1, $2) RETURNING *', inputData);
      })
      .then((result) => {
        console.log(result.rows);
        res.redirect(`/group/${groupId}/members`);
      })
      .catch((error) => console.log(error.stack));

  // res.redirect(`/group/${groupId}/members`);
});

app.get('/group/:id/ideas', checkAuth, groupAuth, (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const groupId = Number(req.params.id);
    const groupDetails = {};
    groupDetails.id = groupId;

    const ideasQuery = `select e.id, e.user_id, e.description,e.location,e.start_date,e.end_date,e.link,users.username from events_repository e INNER JOIN users on users.id = e.user_id where e.group_id = ${groupId} ORDER BY e.end_date ASC`;
    pool.query(ideasQuery, (ideasQueryError, ideasQueryResult) => {
      if (ideasQueryError) {
        console.log('error', ideasQueryError);
      } else {
        console.log(ideasQueryResult.rows);
        const allIdeas = ideasQueryResult.rows;

        res.render('ideas', {allIdeas, groupDetails});
      }
    });
  }
  // res.render('ideas', {groupDetails});
});

app.put('/idea/:id/:ideaId/edit', (req, res) => {
  const groupId = Number(req.params.id);
  const ideaId = Number(req.params.ideaId);
  const ideaData = req.body;
  const inputData = [Number(req.cookies.userId), groupId, ideaData.description, ideaData.link, ideaData.location, ideaData.sdate, ideaData.edate];

  console.log(inputData, 'edited form');

  pool
      .query(`UPDATE events_repository SET description = '${ideaData.description}' , link = '${ideaData.link}' , location = '${ideaData.location}' , start_date = '${ideaData.sdate}' , end_date = '${ideaData.edate}' where id = ${ideaId}`)

      .then((result) => {
        console.log(result.rows);
        res.redirect(`/group/${groupId}/ideas`);
      }).catch((error) => console.log(error.stack));
});

app.delete('/idea/:id/:ideaId/delete', (req, res) => {
  const ideaId = Number(req.params.ideaId);
  const groupId = Number(req.params.id);
  const deleteIdeaQuery = `DELETE FROM events_repository WHERE id = ${ideaId}`;
  pool.query(deleteIdeaQuery, (deleteIdeaQueryError, deleteIdeaQueryResult) => {
    if (deleteIdeaQueryError) {
      console.log('error', deleteIdeaQueryError);
    } else {
      res.redirect(`/group/${groupId}/ideas`);
    }
  });
});

app.post('/create-idea/:id', (req, res) => {
  const groupId = Number(req.params.id);
  const ideaData = req.body;
  const inputData = [Number(req.cookies.userId), groupId, ideaData.description, ideaData.link, ideaData.location, ideaData.sdate, ideaData.edate];

  console.log(inputData);

  pool
      .query('INSERT INTO events_repository (user_id, group_id, description, link, location, start_date, end_date) VALUES ($1, $2, $3,$4,$5,$6,$7) RETURNING id', inputData).then((result) => {
        console.log(result.rows);
        res.redirect(`/group/${groupId}/ideas`);
      }).catch((error) => console.log(error.stack));

  // res.redirect(`/group/${groupId}/ideas`);
}),

app.get('/group/:id/trips', checkAuth, groupAuth, (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const groupId = Number(req.params.id);
    const groupDetails = {};
    groupDetails.id = groupId;
    // const tripsQuery = `select * from planned_trips where group_id=${groupId}`;

    const tripsQuery = `select p.id, p.admin_user_id, p.location, p.start_date, p.start_time, users.username from planned_trips p INNER JOIN users on users.id = p.admin_user_id where group_id=${groupId}and p.start_date >= NOW() ORDER BY p.start_date ASC`;

    pool.query(tripsQuery, (tripsQueryError, tripsQueryResult) => {
      if (tripsQueryError) {
        console.log('error', tripsQueryError);
      } else {
        console.log(tripsQueryResult.rows);
        const allTrips = tripsQueryResult.rows;

        res.render('planned-trips', {allTrips, groupDetails});
      }
    });
  }
} );

app.post('/create-trip/:id', (req, res) => {
  const groupId = Number(req.params.id);
  const tripData = req.body;
  const inputData = [Number(req.cookies.userId), groupId, tripData.date, tripData.start_time, tripData.location];

  console.log(inputData);

  pool
      .query('INSERT INTO planned_trips (admin_user_id, group_id, start_date, start_time, location) VALUES ($1, $2, $3,$4,$5) RETURNING id', inputData).then((result) => {
        console.log(result.rows);
        res.redirect(`/group/${groupId}/trips`);
      }).catch((error) => console.log(error.stack));

  // res.redirect(`/group/${groupId}/trips`);
});

app.put('/trip/:id/:tripId/edit', (req, res) => {
  const groupId = Number(req.params.id);
  const tripId = Number(req.params.tripId);
  const tripData = req.body;
  const inputData = [Number(req.cookies.userId), groupId, tripData.date, tripData.start_time, tripData.location];


  pool
      .query(`UPDATE planned_trips SET start_date = '${tripData.date}' , start_time = '${tripData.start_time}' , location = '${tripData.location}' where id = ${tripId}`)

      .then((result) => {
        console.log(result.rows);
        res.redirect(`/group/${groupId}/trips`);
      }).catch((error) => console.log(error.stack));
});

app.delete('/trip/:id/:tripId/delete', (req, res) => {
  const tripId = Number(req.params.tripId);
  const groupId = Number(req.params.id);
  const deleteIdeaQuery = `DELETE FROM planned_trips WHERE id = ${tripId}`;
  pool.query(deleteIdeaQuery, (deleteIdeaQueryError, deleteIdeaQueryResult) => {
    if (deleteIdeaQueryError) {
      console.log('error', deleteIdeaQueryError);
    } else {
      res.redirect(`/group/${groupId}/trips`);
    }
  });
});

app.get('/group/:id/trips/:tripId', checkAuth, groupAuth, (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    console.log(req.params);

    const tripId = Number(req.params.tripId);
    const groupId = Number(req.params.id);
    const groupDetails = {};
    groupDetails.id = groupId;

    // const tripQuery = `select * from planned_trips where id=${tripId}`;
    const tripQuery = `select p.id,p.start_date,p.start_time,p.location, u.username from planned_trips p INNER JOIN users u on u.id = p.admin_user_id  where p.id=${tripId}`;
    const allIdeasQuery = `select * from events_repository where group_id=${groupId}`;
    const tripEventsQuery = `select p.id, p.event_id, r.description, r.location, p.start_time, p.end_time, r.link from events_planned p INNER JOIN events_repository r on p.event_id = r.id where p.planned_trip_id = ${tripId}`;

    const results = Promise.all([
      pool.query(tripQuery),
      pool.query(allIdeasQuery),
      pool.query(tripEventsQuery),
    ]);

    results.then((allResults) => {
      const [tripQueryResult, ideasQueryResult, tripEventsQueryResult] = allResults;
      // console.log(tripQueryResult.rows, '1');
      // console.log(ideasQueryResult.rows, '2');

      const tripDetails = tripQueryResult.rows[0];
      const allIdeas = ideasQueryResult.rows;
      const tripEvents = tripEventsQueryResult.rows;

      res.render('single-trip', {tripDetails, tripEvents, groupDetails, allIdeas});
    });
  }
} );

app.post('/create-trip-event/:groupId/:tripId', (req, res) => {
  console.log(req.params);
  const tripId = Number(req.params.tripId);
  const groupId = Number(req.params.groupId);
  const activityData = req.body;

  // console.log(activityData);
  console.log(tripId);

  const inputData = [tripId, activityData.idea_id, activityData.start_time, activityData.end_time];

  pool
      .query('INSERT INTO events_planned (planned_trip_id, event_id, start_time, end_time ) VALUES ($1, $2, $3,$4) RETURNING id', inputData).then((result) => {
        console.log(result.rows);
        res.redirect(`/group/${groupId}/trips/${tripId}`);
      }).catch((error) => console.log(error.stack));

  res.redirect(`/group/${groupId}/trips/${tripId}`);
});

app.put('/trip-event/:id/:tripId/:tripEventId/edit', (req, res) => {
  const tripId = Number(req.params.tripId);
  const groupId = Number(req.params.id);
  const groupDetails = {};
  groupDetails.id = groupId;
  const tripEventId = Number(req.params.tripEventId);
  const activityData = req.body;

  pool
      .query(`UPDATE events_planned SET event_id = '${activityData.idea_id}' , start_time = '${activityData.start_time}' , end_time = '${activityData.end_time}' where id = ${tripEventId}`)

      .then((result) => {
        console.log(result.rows);
        res.redirect(`/group/${groupId}/trips/${tripId}`);
      }).catch((error) => console.log(error.stack));
});

app.delete('/trip-event/:id/:tripId/:tripEventId/delete', (req, res) => {
  const tripId = Number(req.params.tripId);
  const groupId = Number(req.params.id);
  const groupDetails = {};
  groupDetails.id = groupId;
  const tripEventId = Number(req.params.tripEventId);

  const deleteEventQuery = `DELETE FROM events_planned WHERE id = ${tripEventId}`;
  pool.query(deleteEventQuery, (deleteEventQueryError, deleteEventQueryResult) => {
    if (deleteEventQueryError) {
      console.log('error', deleteEventQueryError);
    } else {
      res.redirect(`/group/${groupId}/trips/${tripId}`);
    }
  });
});

app.get('/group/:id/archive', checkAuth, groupAuth, (req, res) => {
  if (req.isUserLoggedIn === false) {
    res.redirect('/login');
  } else {
    const groupId = Number(req.params.id);
    const groupDetails = {};
    groupDetails.id = groupId;
    // const tripsQuery = `select * from planned_trips where group_id=${groupId}`;

    const tripsQuery = `select p.id, p.admin_user_id, p.location, p.start_date, p.start_time, users.username from planned_trips p INNER JOIN users on users.id = p.admin_user_id where group_id=${groupId}and p.start_date < NOW() ORDER BY p.start_date ASC`;

    pool.query(tripsQuery, (tripsQueryError, tripsQueryResult) => {
      if (tripsQueryError) {
        console.log('error', tripsQueryError);
      } else {
        console.log(tripsQueryResult.rows);
        const allTrips = tripsQueryResult.rows;

        res.render('historical-trips', {allTrips, groupDetails});
      }
    });
  }
} );

app.listen(PORT);
