import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const FamilyPlans = new Mongo.Collection('familyPlans');
export const FamilyPlanParticipants = new Mongo.Collection('familyPlanParticipants');

if (Meteor.isServer) {

    function _unlinkFamilyPlanParticipant(familyPlanParticipantId) {
        FamilyPlanParticipants.update(familyPlanParticipantId, {$set: {status: "new", lastActionByUserId: this.userId,}, $unset: {familyPlanId: ""}});
    }

    function _notifyFamilyPlanParticipant(familyPlanParticipantId, newStatus) {
        let _fpp = FamilyPlanParticipants.findOne(familyPlanParticipantId);
        let _u = _fpp && Meteor.users.findOne(_fpp.userId);
        let _emails = _u && _u.emails && _.pluck(_u.emails, "address");

        if (_emails) {
            const msg = {
                to: _emails,
                from: 'm.ign415@gmail.com',
                subject: 'Splitsies: spend together',
                text: "These's been a change in your family plans or family plan memberships. Check your dashboard: https://splitsies.meteorapp.com/dashboard",
                html: "<strong>These's been a change in your family plans or family plan memberships. Check your dashboard: https://splitsies.meteorapp.com/dashboard</strong>",
            };
            sgMail.send(msg);
        }
    }

    function _notifyFamilyPlanOwner(familyPlanId, newStatus) {
        let _fp = FamilyPlans.findOne(familyPlanId);
        let _u = _fp && Meteor.users.findOne(_fp.userId);
        let _emails = _u && _u.emails && _.pluck(_u.emails, "address");

        if (_emails) {
            const msg = {
                to: _emails,
                from: 'm.ign415@gmail.com',
                subject: 'Splitsies: spend together',
                text: "These's been a change in your family plans or family plan memberships. Check your dashboard: https://splitsies.meteorapp.com/dashboard",
                html: "<strong>These's been a change in your family plans or family plan memberships. Check your dashboard: https://splitsies.meteorapp.com/dashboard</strong>",
            };
            sgMail.send(msg);
        }
    }

    Meteor.publish('openOffers', function openOffersPublication(offeringBool, productIds) {
        check(offeringBool, Boolean);
        check(productIds, Array);

        if (offeringBool) {
            return FamilyPlans.find({
                $where: function() { return this.members < this.capacity },
                productId: { $in: productIds },
            });
        } else {
            return FamilyPlanParticipants.find({
                productId: { $in: productIds },
                status: "new",
                familyPlanId: { $exists: false },
            });
        }
    });

    Meteor.publish("openPlanParticipantsPerProduct", function openPlanParticipants() {
        return FamilyPlanParticipants.find({status: "new", familyPlanId: { $exists: false }}, {fields: {productId: 1}});
    });

    Meteor.publish("openPlansPerProduct", function openPlansPerProduct() {
        return FamilyPlans.find({$where: function() { return this.members < this.capacity }}, {fields: {productId: 1, userId: 1}});
    });

    Meteor.publish("yourFamilyPlanMemberships", function yourFamilyPlanMemberships() {
        if (!this.userId) {
            return this.ready();
        }

        return FamilyPlanParticipants.find({userId: this.userId});
    });

    Meteor.publish("yourFamilyPlans", function yourFamilyPlans() {
        if (!this.userId) {
            return this.ready();
        }

        return FamilyPlans.find({userId: this.userId});
    });

    Meteor.publish("familyPlansByIds", function familyPlansByIds(familyPlanIds) {
        check(familyPlanIds, Array);

        if (!this.userId) {
            return this.ready();
        }

        return FamilyPlans.find({_id: {$in: familyPlanIds}});
    });

    Meteor.publish("familyPlanParticipants", function familyPlanParticipants(familyPlanIds) {
        check(familyPlanIds, Array);

        if (!this.userId) {
            return this.ready();
        }

        return FamilyPlanParticipants.find({familyPlanId: { $in: familyPlanIds } });
    });

    Meteor.methods({
        'create.new.offer'(productId, offeringBool, price, capacity, notes) {
            check(productId, String);
            check(offeringBool, Boolean);
            check(price, Number);
            check(capacity, Number);
            check(notes, String);

            if (!this.userId) {
                throw new Meteor.Error("You need to be logged in.");
            }

            if (offeringBool) {
                // create a FamilyPlans and FamilyPlanParticipants objects for the user
                let _familyPlanId = FamilyPlans.insert({
                    productId: productId,
                    price: price,
                    userId: this.userId,
                    capacity: capacity,
                    notes: notes,
                    members: 1,
                });

                return FamilyPlanParticipants.insert({
                    userId: this.userId,
                    familyPlanId: _familyPlanId,
                    status: "joined",
                    productId: productId,
                    lastActionByUserId: this.userId,
                    price: parseFloat((price / capacity).toFixed(2)),
                });
            } else {
                // create a new FamilyPlanParticipants without a planId field, with productId field, status "new"
                return FamilyPlanParticipants.insert({
                    userId: this.userId,
                    status: "new",
                    productId: productId,
                    lastActionByUserId: this.userId,
                    price: price,
                });
            }
        },
        "terminateFamilyPlanParticipant"(familyPlanParticipantId) {
            check(familyPlanParticipantId, String);

            let _participant = FamilyPlanParticipants.findOne(familyPlanParticipantId);
            let _plan = FamilyPlans.findOne(_participant.familyPlanId);

            if (!this.userId || !_plan) {
                throw new Meteor.Error("You need to be logged in and there should be a plan.");
            }

            _unlinkFamilyPlanParticipant(familyPlanParticipantId);
            _notifyFamilyPlanParticipant(familyPlanParticipantId, "new");

            FamilyPlans.update(_participant.familyPlanId, { $inc: { members: -1 } });
            _notifyFamilyPlanOwner(_participant.familyPlanId, "new");
        },
        'delete.offer'(offerId) {
            check(offerId, String);

            let _o = FamilyPlanParticipants.findOne(offerId);

            if (!this.userId || !_o || _o.userId !== this.userId) {
                throw new Meteor.Error("You need to be logged in and be the owner of this family plan.");
            }

            // if status was "pending" or "joined" (i.e., document has familyPlanId property), decrease members by 1
            if (_o.familyPlanId) {
                FamilyPlans.update(_o.familyPlanId, { $inc: { members: -1 } });
            }

            FamilyPlanParticipants.remove(offerId);
        },
        'respond.tentatively'(id, offeringBool, familyPlanDetails) {
            check(id, String);
            check(offeringBool, Boolean);

            if (!this.userId) {
                throw new Meteor.Error("You need to be logged in.");
            }

            if (offeringBool) {
                // this means someone is joining your family plan
                // check if you already have an open family plan offer for others to join
                let _joinee = FamilyPlanParticipants.findOne(id);

                let _yourFamilyPlan = FamilyPlans.findOne({
                    userId: this.userId,
                    productId: _joinee.productId,
                    $where: function() { return this.members < this.capacity },
                });

                let _familyPlanId;
                if (!_yourFamilyPlan) {
                    check(familyPlanDetails, Object);
                    check(familyPlanDetails.price, Number);
                    check(familyPlanDetails.capacity, Number);
                    check(familyPlanDetails.notes, String);

                    // create a FamilyPlan and a FamilyPlanParticipant for yourself
                    _familyPlanId = FamilyPlans.insert({
                        productId: _joinee.productId,
                        price: familyPlanDetails.price,
                        userId: this.userId,
                        capacity: familyPlanDetails.capacity,
                        notes: familyPlanDetails.notes,
                        members: 1,
                    });
                    FamilyPlanParticipants.insert({
                        userId: this.userId,
                        familyPlanId: _familyPlanId,
                        status: "joined",
                        productId: _joinee.productId,
                        lastActionByUserId: this.userId,
                        price: parseFloat((familyPlanDetails.price / familyPlanDetails.capacity).toFixed(2)),
                    });
                } else {
                    _familyPlanId = _yourFamilyPlan._id;
                }

                // increment members by 1
                FamilyPlans.update(_familyPlanId, { $inc: { members: 1 } });

                // link joinee and mark their status as pending
                FamilyPlanParticipants.update(_joinee._id, { $set: { familyPlanId: _familyPlanId, status: "pending", lastActionByUserId: this.userId, } });
                _notifyFamilyPlanParticipant(_joinee._id, "pending");
                _notifyFamilyPlanOwner(_familyPlanId, "pending");
            } else {
                // this means you are joining someone else's existing, open family plan
                let _familyPlan = FamilyPlans.findOne(id);

                // check if you have any open offers (status "new")
                let _yourOpenOffer = FamilyPlanParticipants.findOne({
                    userId: this.userId,
                    productId: _familyPlan.productId,
                    status: "new",
                });

                if (!_yourOpenOffer) {
                    let _fppId = FamilyPlanParticipants.insert({
                        userId: this.userId,
                        familyPlanId: _familyPlan._id,
                        status: "pending",
                        productId: _familyPlan.productId,
                        lastActionByUserId: this.userId,
                        price: parseFloat((_familyPlan.price / _familyPlan.capacity).toFixed(2)),
                    });
                    _notifyFamilyPlanParticipant(_fppId, "pending");
                } else {
                    FamilyPlanParticipants.update(_yourOpenOffer._id, { $set: { familyPlanId: _familyPlan._id, status: "pending", lastActionByUserId: this.userId, } });
                    _notifyFamilyPlanParticipant(_yourOpenOffer._id, "pending");
                }

                // increment members by 1
                FamilyPlans.update(_familyPlan._id, { $inc: { members: 1 } });
                _notifyFamilyPlanOwner(_familyPlan._id, "pending");
            }
        },
        "respond.to.pending.offer"(familyPlanParticipantId, acceptBool) {
            check(familyPlanParticipantId, String);
            check(acceptBool, Boolean);

            if (!this.userId) {
                throw new Meteor.Error("You need to be logged in.");
            }

            let _participant = FamilyPlanParticipants.findOne(familyPlanParticipantId);

            if (acceptBool) {
                // set status to "joined"
                FamilyPlanParticipants.update(familyPlanParticipantId, {$set: {status: "joined", lastActionByUserId: this.userId,}});
            } else {
                // decrease FamilyPlan members by 1
                FamilyPlans.update(_participant.familyPlanId, { $inc: { members: -1 } });

                // set status to "new", unset familyPlanId
                _unlinkFamilyPlanParticipant(familyPlanParticipantId);
            }

            _notifyFamilyPlanParticipant(familyPlanParticipantId, acceptBool ? "joined" : "new");
            _notifyFamilyPlanOwner(_participant.familyPlanId, acceptBool ? "joined" : "new");
        },
    })
}