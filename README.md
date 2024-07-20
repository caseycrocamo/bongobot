# bongobot
Hello :wave:!
I have two main functions, creating discord timestamps and managing user profiles.
## Timestamp Commands
The timestamp commands allow you to create a timestamp that Discord knows how to parse. Discord will convert timestamps to the user's timezone automatically which is super handy for coordination. This command will send a message that only you can see. Don't worry about cluttering up any channels with bot messages!
### Relative
`/timestamp relative` - This is the simpler timestamp command. It creates a timestamp that counts down in real time.
#### Example result
<t:1722910364:R>

#### Parameters
`how_long`: Use the format `in 9 hours 30 minutes` or `in 9h 30m`. You do have to lead with the word "in"! If you specified `9 hours 30 minutes` you would get back a timestamp that counts down from 9 hours and 30 minutes.
### Absolute
`/timestamp absolute` - This is the more complicated (but more configurable) timestamp command. You specify an absolute date / time and can even specify what type of timestamp you want.
#### Example result
<t:1725940800:f>

#### Parameters
`date`: Use the format `M/DD/YY`. For example, December 27th, 2024 would be 12/27/24.

`time`: Use the format `H:MMam`. For example, 9:00pm. This time should be in YOUR timezone (or the one you select for the next param).

`timezone`: Select YOUR timezone. 

`type`: Select the format you want the timestamp displayed in. `Relative` is similar to the previous command, the rest are pretty self explanatory. 
## Profile Command
The profile command allows you to manipulate your discord server profile. BongoBot profiles change your name color and icon. They are a fun way to show off your achievements, class preferences, etc.
Activate this command by typing `/profile`. It will respond with a message that only you can see so do not worry about which channel you use the command in.
### Actions
#### Remove Role
Removes your current role and resets your name color to the default color.
#### Choose a Profession
Allows you to show off your allegiance to one of the professions in GW2. Available by default for all users.
#### Choose a Crafting Discipline
Allows you to show off your allegiance to one of the crafting disciplines in GW2. Available by default for all users.
Show off an Achievement: Show off one of your earned achievements. See the achievement command for info on earning achievements.
## Achievement Commands
View and earn achievements that you can show off on your profile!
### View
`/achievements view` - This command shows all available achievements along with your progress in achieving them. Similar to the commands above it will send a message that only you can see.
### Achieve
`/achievements achieve` - Achieve an achievement and unlock a new profile. This will send a public message in whichever channel you used the command in!
#### Parameters
`achievement`: Select the role of the achievement you wish to achieve. You can start typing to "search" and filter the displayed discord roles. This param allows you to select from EVERY role in the discord server. However, you must select a role that corresponds to a BongoBot achievement for the command to word.

`proof` (optional): Provide a link to some proof that you achieved this achievement. Only text is supported, links count! :sparkles: The gold standard for proof is a log from https://dps.report :sparkles: