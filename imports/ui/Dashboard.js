import React, { Component } from 'react';
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import { Row, Col, Card, Table, CardHeader, CardBody, Button, Modal, ModalHeader, ModalBody, ModalFooter, Progress, Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { Products as ProductsCollection } from '../api/products.js';
import { Categories as CategoriesCollection } from '../api/categories.js';
import { FamilyPlans, FamilyPlanParticipants } from '../api/familyPlans.js';
import { Users } from '../api/users.js';

class Dashboard extends Component {
    constructor(props) {
        super(props);

        this.state = {
            modal: false,
            modalType: undefined,
            selectedOfferId: undefined,
            alertVisible: false,
            alertMessage: "",
            alertType: "",
        };

        this.toggle = this.toggle.bind(this);
        this.onDismiss = this.onDismiss.bind(this);
    }

    onDismiss() {
        this.setState({ alertVisible: false });
    }

    toggle(offerId, optionalType) {
        this.setState({
            modal: !this.state.modal,
            selectedOfferId: offerId,
            modalType: optionalType,
        });
    }

    deleteOffer(offerId) {
        let _that = this;
        Meteor.call("delete.offer", offerId, function (err, res) {
            if (!err) {
                _that.setState({
                    alertVisible: true,
                    alertType: "success",
                    alertMessage: "Offer deleted successfully."
                });
            } else {
                _that.setState({
                    alertVisible: true,
                    alertType: "danger",
                    alertMessage: "There's been an error: " + err.message + "."
                });
            }
        });
    }

    terminate() {
        let _that = this;
        Meteor.call("terminateFamilyPlanParticipant", this.state.selectedOfferId, function (err, res) {
            if (!err) {
                _that.toggle();
                _that.setState({
                    alertVisible: true,
                    alertType: "success",
                    alertMessage: "Plan member successfully removed.",
                });
            } else {
                _that.setState({
                    alertVisible: true,
                    alertType: "danger",
                    alertMessage: "There's been an error: " + err.message + "."
                });
            }
        });
    }

    deleteFamilyPlan() {
        let _that = this;
        Meteor.call("deleteFamilyPlan", this.state.selectedOfferId, function (err, res) {
            if (!err) {
                _that.toggle();
                _that.setState({
                    alertVisible: true,
                    alertType: "success",
                    alertMessage: "Family plan deleted successfully.",
                });
            } else {
                _that.setState({
                    alertVisible: true,
                    alertType: "danger",
                    alertMessage: "There's been an error: " + err.message + "."
                });
            }
        });
    }

    dashboardAction(acceptBool) {
        let _that = this;
        Meteor.call("respond.to.pending.offer", this.state.selectedOfferId, acceptBool, function (err, res) {
            if (!err) {
                _that.toggle();
                _that.setState({
                    alertVisible: true,
                    alertType: "success",
                    alertMessage: "Your response has been recorded."
                });
            } else {
                _that.setState({
                    alertVisible: true,
                    alertType: "danger",
                    alertMessage: "There's been an error: " + err.message + "."
                });
            }
        });
    }

    getUser(userId) {
        return _.find(this.props.users, function (u) { return u._id === userId; })
    }

    render() {
        let _m = this.state.selectedOfferId && (FamilyPlanParticipants.findOne(this.state.selectedOfferId) || FamilyPlans.findOne(this.state.selectedOfferId));
        let _joinee = _m && this.getUser(_m.userId);
        let _joineeUsername = _joinee && _joinee.username;
        let _product = _m && ProductsCollection.findOne(_m.productId);
        let _productName = _product && _product.name;
        let _plan = _m && (FamilyPlans.findOne(_m.familyPlanId) || FamilyPlans.findOne(_m._id));
        let _planOwner = _plan && _plan.userId && this.getUser(_plan.userId);
        let _planOwnerUsername = _planOwner && _planOwner.username;
        let _youArePlanOwner = _planOwner && _planOwner._id === Meteor.userId();


        return (
            <div>
                <Row>
                    <Col sm="12">
                        <Card className="looking">
                            <CardHeader>Looking for...</CardHeader>
                            <CardBody>
                                <Table bordered>
                                    <tbody>
                                        {this.props.lookingFor.map((o) => {
                                            let _p = _.find(this.props.products, function (p) {
                                                return p._id === o.productId;
                                            });
                                            let _familyPlan = o.status === "pending" && _.find(this.props.pendingLookingForPlans, function (pl) {return pl._id === o.familyPlanId;});
                                            let _counterpartyUser = _familyPlan && _familyPlan.userId && this.getUser(_familyPlan.userId);
                                            let _counterpartyUsername = _counterpartyUser && _counterpartyUser.username || "Someone";

                                            return (<tr key={o._id}>
                                                <td>{_counterpartyUsername + "'s " + (_p && _p.name)}</td>
                                                <td>{o.status === "pending" ? (o.lastActionByUserId === o.userId ? "Waiting for response" : <Button onClick={this.toggle.bind(this, o._id, "offerResponse")}>Respond to offer</Button>) : <span>No offers <Button onClick={this.deleteOffer.bind(this, o._id)} color="danger">Delete request</Button></span>}</td>
                                            </tr>);
                                        })}
                                    </tbody>
                                </Table>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
                <br/>
                <Row>
                    <Col sm="12">
                        <Card className="offering">
                            <CardHeader>Offering...</CardHeader>
                            <CardBody>
                                {this.props.offering.map((o) => {
                                    let _p = _.find(this.props.products, function (p) {
                                        return p._id === o.productId;
                                    });
                                    let _members = _.filter(this.props.membersOfMyPlans, function (m) {return m.status !== "joined" && m.familyPlanId === o._id && m.userId !== Meteor.userId();});

                                    return (<div key={o._id}>
                                        {"Your " + (_p && _p.name) + " (" + _members.length + " requests)"}
                                        <Table bordered>
                                            <tbody>
                                                {_members.map((m) => {
                                                    let _u = this.getUser(m.userId);

                                                    return (<tr key={m._id}>
                                                        <td>{_u && _u.username}</td>
                                                        <td>{m.lastActionByUserId !== m.userId ? "Waiting for response" : <Button onClick={this.toggle.bind(this, m._id, "offerResponse")}>Respond to offer</Button>}
                                                        </td>
                                                    </tr>);
                                                })}
                                            </tbody>
                                        </Table>
                                    </div>);
                                })}
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
                <br/>
                <Row>
                    <Col sm="12">
                        <Card className="card-neutral">
                            <CardHeader>Splitting...</CardHeader>
                            <CardBody>
                                <Table bordered>
                                    <tbody>
                                        {this.props.splittingPlans.map((o) => {
                                            let _youOwnPlan = o.userId === Meteor.userId();
                                            let _p = _.find(this.props.products, function (p) {return p._id === o.productId;});
                                            let _planOwner = this.getUser(o.userId);
                                            let _members = _.filter(this.props.splittingParticipants, function (m) { return m.familyPlanId === o._id; });
                                            let _numJoined = _members.length;
                                            let _numPending = o.members - _members.length;

                                            return (<tr key={o._id}>
                                                <td>{_youOwnPlan ? "Your " : ((_planOwner && _planOwner.username) + "'s ")}{_p && _p.name}{' (' + _members.length + ' out of ' + o.capacity + ' members max)'}
                                                    {_youOwnPlan && <Button onClick={this.toggle.bind(this, o._id, "deleteFamilyPlan")} color="danger">Delete plan</Button>}
                                                    <br/>
                                                    <Progress multi>
                                                        <Progress bar color="success" value={100 * _numJoined / o.capacity}>Joined ({_numJoined})</Progress>
                                                        {_numPending > 0 && <Progress bar color="info" value={100 *_numPending / o.capacity}>Pending ({_numPending})</Progress>}
                                                    </Progress>
                                                    <br/>
                                                    <Row>
                                                        {_members.map((m) => {
                                                            let _u = this.getUser(m.userId);
                                                            let _canTerminate = (_youOwnPlan && m.userId !== Meteor.userId()) || (!_youOwnPlan && m.userId === Meteor.userId());

                                                            return <Col sm="4" key={m._id}>
                                                                {_canTerminate ? <Alert color="primary" toggle={this.toggle.bind(this, m._id, "terminate")} isOpen={true}>
                                                                        { (_u && _u.username && m.userId === Meteor.userId() && "you") || (_u && _u.username)}
                                                                    </Alert> :
                                                                    <Alert color="primary" isOpen={true} key={m._id}>
                                                                        { (_u && _u.username && m.userId === Meteor.userId() && "you") || (_u && _u.username)}
                                                                    </Alert>
                                                                }
                                                            </Col>
                                                        })}
                                                    </Row>
                                                </td>
                                                <td>{_youOwnPlan ? "+" : "-"}{"$"}{_youOwnPlan ? (o.price * (_members.length - 1) / (_members.length)).toFixed(2) : (o.price / _members.length).toFixed(2)}</td>
                                            </tr>);
                                        })}
                                    </tbody>
                                </Table>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
                <br/>
                <Modal isOpen={this.state.modal} toggle={this.toggle.bind(this, undefined, undefined)} className={this.props.className}>
                    <ModalHeader toggle={this.toggle.bind(this, undefined, undefined)}>
                        {this.state.modalType === "terminate" ?
                            ("Are you sure you want to remove " + (_youArePlanOwner ? _joineeUsername : "yourself") + " from " +
                            (_youArePlanOwner ? "your " : ( _planOwnerUsername + "'s ")) + _productName + " family plan") :
                            this.state.modalType === "offerResponse" ?
                                (_joineeUsername + " is joining " + _productName) :
                                this.state.modalType === "deleteFamilyPlan" ?
                                    ("Are you sure you want to delete your " + _productName) :
                                    null
                        }
                    </ModalHeader>
                    <ModalBody>
                        {this.state.modalType === "terminate" ?
                            "Terminating a participant's membership will increase your share of the bill." :
                            this.state.modalType === "offerResponse" ?
                                "Letting someone into your family plan will decrease your share of the bill." :
                                this.state.modalType === "deleteFamilyPlan" ?
                                    ("Deleting your family plan will affect " + (_.filter(this.props.membersOfMyPlans, function (m) {return _plan && m.familyPlanId === _plan._id}).length - 1) + " other people who are currently splitting it with you.") :
                                    null
                        }
                    </ModalBody>
                    <ModalFooter>
                        {this.state.modalType === "offerResponse" ? <div>
                                <Button color="success" onClick={this.dashboardAction.bind(this, true)}>Accept</Button>{' '}
                                <Button color="danger" onClick={this.dashboardAction.bind(this, false)}>Decline</Button>{' '}
                                <Button color="secondary" onClick={this.toggle.bind(this, undefined, undefined)}>Cancel</Button>
                            </div> :
                            this.state.modalType === "terminate" ?
                                <div>
                                    <Button color="danger" onClick={this.terminate.bind(this)}>Terminate</Button>{' '}
                                    <Button color="secondary" onClick={this.toggle.bind(this, undefined, undefined)}>Cancel</Button>
                                </div> : this.state.modalType === "deleteFamilyPlan" ?
                                    <div>
                                        <Button color="danger" onClick={this.deleteFamilyPlan.bind(this)}>Yes, delete</Button>{' '}
                                        <Button color="secondary" onClick={this.toggle.bind(this, undefined, undefined)}>Cancel</Button>
                                    </div> : null}
                    </ModalFooter>
                </Modal>
                <Alert color={this.state.alertType} isOpen={this.state.alertVisible} toggle={this.onDismiss}>
                    {this.state.alertMessage}
                </Alert>
            </div>
        );
    }
}

export default withTracker((props) => {
    let _plansSub = Meteor.subscribe("yourFamilyPlans");
    let _membershipsSub = Meteor.subscribe("yourFamilyPlanMemberships");
    let _myPlans = FamilyPlans.find({userId: Meteor.userId()}).fetch();
    let _myPlanMemberships = FamilyPlanParticipants.find({userId: Meteor.userId()}).fetch();
    let _lookingFor = _.filter(_myPlanMemberships, function (m) {
        return m.status === "new" || m.status === "pending";
    });

    // get owners of plans I am looking for that are pending
    let _pendingMemberships = _.filter(_myPlanMemberships, function (m) { return m.status === "pending"; });
    let _pendingLookingForPlanIds = _.pluck(_pendingMemberships, "familyPlanId");
    Meteor.subscribe("familyPlansByIds", _pendingLookingForPlanIds);
    let _pendingLookingForPlans = FamilyPlans.find({_id: {$in: _pendingLookingForPlanIds}}).fetch();
    let _pendingLookingForOwnerIds = _.pluck(_pendingLookingForPlans, "userId");

    // IDs of plans that you're the owner of
    let _myPlanIds = _.pluck(_myPlans, "_id");
    let _membersOfMyPlans = _myPlans.length > 0 && Meteor.subscribe("familyPlanParticipants", _myPlanIds).ready() &&
        FamilyPlanParticipants.find({familyPlanId: {$in: _myPlanIds}}).fetch() || [];

    // plans you are offering that aren't at their capacity yet (based on number of people that fully joined)
    let _offering = _.filter(_myPlans, function (p) {
        let _joined = _.filter(_membersOfMyPlans, function (m) { return m.familyPlanId === p._id && m.status === "joined"; });
        return p.capacity > _joined.length;
    });

    // plan IDs I am a member of
    // todo: is all this necessary?
    let _planIdsIAmSplittingWithOthers = _.pluck(_.filter(_myPlanMemberships, function (m) {return m.status === "joined";}), "familyPlanId");
    let _participantsOfPlansIHaveSplitWithOthers = _planIdsIAmSplittingWithOthers.length > 0 &&
        Meteor.subscribe("familyPlanParticipants", _planIdsIAmSplittingWithOthers).ready() &&
        FamilyPlanParticipants.find({familyPlanId: {$in: _planIdsIAmSplittingWithOthers}, status: "joined"}).fetch() || [];
    let _userIdsOfPeopleIAmSplittingPlansWith = _.pluck(_participantsOfPlansIHaveSplitWithOthers, "userId");
    let _plansIAmSplitting = _planIdsIAmSplittingWithOthers.length > 0 &&
        Meteor.subscribe("familyPlansByIds", _planIdsIAmSplittingWithOthers).ready() &&
        FamilyPlans.find({_id: {$in: _planIdsIAmSplittingWithOthers}}).fetch() || [];


    // let _offersSub = Meteor.subscribe("userOffers");



    let _productsSub = Meteor.subscribe("products");
    let _products = ProductsCollection.find({}).fetch();
    let _usersSub = Meteor.subscribe("users", _.union(_.pluck(_membersOfMyPlans, "userId"), _userIdsOfPeopleIAmSplittingPlansWith, _pendingLookingForOwnerIds));

    return {
        membersOfMyPlans: _membersOfMyPlans,
        currentUser: Meteor.user(),
        lookingFor: _lookingFor,
        pendingLookingForPlans: _pendingLookingForPlans,
        offering: _offering,
        splittingPlans: _plansIAmSplitting,
        splittingParticipants: _participantsOfPlansIHaveSplitWithOthers,
        products: _products,
        users: Users.find({}).fetch(),
    };
})(Dashboard);