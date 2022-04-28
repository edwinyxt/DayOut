# DayOut
DayOut allows you to collaborate with groups of friends for day trip ideation and planning

#### Tech Used
Bootstrap, PostgreSQL, NodeJS, Express

#### Features
- Form groups and add members
- Profile and display your interests to the group
- Collaborate on trip activities ideation
- Plan for trips and inform group on time and location
- Schedule a trip using members' activity ideas posted

#### Future enhancements
- Members upvoting on ideas page
- Category tagging on ideas
- Sorting based on upvotes
- Filtering based on category tags
- Chat and commenting on future trips planned
- Ability to add/edit personal and group profile pics
- Ability to add photo albums to completed trips for reminiscing memories
- Form validations

#### Entity Relationship Diagram
![Database ER diagram (crow's foot)](https://user-images.githubusercontent.com/91788744/165343937-8b76f7c7-dc18-48a8-8eb5-66b971db3a8e.jpeg)
Deployed URL: https://tranquil-beyond-17092.herokuapp.com/

#### Post mortem notes
https://gist.github.com/upieez/0794b2d6a2727132c043e1380c4169df

What went well? Please share a link to the specific code.
- Used column and dbname aliases for join queries. Avoided duplicate column naming when 2 tables are joined
- Learnt to use modals and responsive navbars

What were the biggest challenges you faced? Please share a link to the specific code.
- Getting CSS to work the way I want
- Date and time formatting
- Getting 2 auth routes custom middleware to work concurrently without error. Users need to have login auth + group membership check to be allowed access to specific group
- Too many 'layers' in certain routes, eg: app.put('/trip-event/:id/:tripId/:tripEventId/edit') ; maybe theres is better way to handle this?

What would you do differently next time?
- More feature enhancements
- Cleaner and more modern design/UX
- How to do data sorting on client side instead of querying db each time with SQL sort param
