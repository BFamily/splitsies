import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check, Match } from 'meteor/check';

export const Users = Meteor.users;

if (Meteor.isServer) {
    Meteor.publish('users', function usersPublication(userIds) {
        check(userIds, Array);

        let _qry = {
            $or: [{_id: {$in: userIds}}, {username: {$in: userIds}}]
        };

        return Users.find(_qry, {fields: {username: 1, verified: 1, admin: 1}});
    });
}