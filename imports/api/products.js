import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check, Match } from 'meteor/check';

import { Users } from "./users.js";

export const Products = new Mongo.Collection('products');

if (Meteor.isServer) {
    Meteor.publish('products', function productsPublication(optionalProductIds) {
        check(optionalProductIds, Match.OneOf(Array, undefined));

        let _query = {};
        if (!_.isUndefined(optionalProductIds)) {
            _query._id = {$in: optionalProductIds};
        }

        return Products.find(_query);
    });

    Meteor.methods({
        "create.new.product"(categoryId, name, description, company, logoUrl) {
            check(categoryId, String);
            check(name, String);
            check(description, String);
            check(company, String);
            check(logoUrl, String);

            if (!this.userId) {
                throw new Meteor.Error("You need to be logged in.");
            }

            if (!Users.findOne(this.userId).admin) {
                throw new Meteor.Error("You need to be an admin to add a new product.")
            }

            if (Products.findOne({name: name})) {
                throw new Meteor.Error("This product already exists: " + name);
            }

            return Products.insert({categoryId: categoryId, name: name, description: description, company: company, logoUrl: logoUrl});
        },
    });
}