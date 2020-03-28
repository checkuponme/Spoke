import React from "react";
import PropTypes from "prop-types";
import { withRouter } from "react-router";
import { compose } from "react-apollo";
import gql from "graphql-tag";
import { StyleSheet, css } from "aphrodite";

import { loadData } from "./hoc/with-operations";
import theme from "../styles/theme";

const styles = StyleSheet.create({
  container: {
    marginTop: "5vh",
    textAlign: "center",
    color: theme.colors.lightGray
  },
  content: {
    ...theme.layouts.greenBox
  },
  bigHeader: {
    ...theme.text.header,
    fontSize: 40
  },
  logoDiv: {
    ...theme.components.logoDiv
  },
  logoImg: {
    width: 120,
    ...theme.components.logoImg
  },
  header: {
    ...theme.text.header,
    marginBottom: 15,
    color: theme.colors.white
  },
  link_dark_bg: {
    ...theme.text.link_dark_bg
  }
});

class Home extends React.Component {
  state = {
    orgLessUser: false
  };

  componentWillMount() {
    const user = this.props.data.currentUser;
    if (user) {
      if (user.adminOrganizations.length > 0) {
        this.props.history.push(`/admin/${user.adminOrganizations[0].id}`);
      } else if (user.ownerOrganizations.length > 0) {
        this.props.history.push(`/admin/${user.ownerOrganizations[0].id}`);
      } else if (user.superVolOrganizations.length > 0) {
        this.props.history.push(`/admin/${user.superVolOrganizations[0].id}`);
      } else if (user.texterOrganizations.length > 0) {
        this.props.history.push(`/app/${user.texterOrganizations[0].id}`);
      } else {
        this.setState({ orgLessUser: true });
      }
    }
  }

  // not sure if we need this anymore -- only for new organizations
  handleOrgInviteClick = async e => {
    if (
      !window.SUPPRESS_SELF_INVITE ||
      window.SUPPRESS_SELF_INVITE === "undefined"
    ) {
      e.preventDefault();
      const newInvite = await this.props.mutations.createInvite({
        is_valid: true
      });
      if (newInvite.errors) {
        alert("There was an error creating your invite");
        throw new Error(newInvite.errors);
      } else {
        // alert(newInvite.data.createInvite.id)
        this.props.history.push(
          `/login?nextUrl=/invite/${newInvite.data.createInvite.hash}`
        );
      }
    }
  };

  renderContent() {
    if (this.state.orgLessUser) {
      return (
        <div>
          <div className={css(styles.header)}>
            You currently aren't part of any organization!
          </div>
          <div>
            If you got sent a link by somebody to start texting, ask that person
            to send you the link to join their organization. Then, come back
            here and start texting!
          </div>
        </div>
      );
    }
    return (
      <div>
        <div className={css(styles.header)}>
          CheckUpOn.me lets you register as an at-risk individual, because no one should be alone in these uncertain times.
        </div>
        <div>
          <a
            id="signup"
            className={css(styles.link_dark_bg)}
            href={"/signup"}
          >
            Sign Up
          </a>
        </div>
        <div>
          <a
            id="login"
            className={css(styles.link_dark_bg)}
            href={window.ALTERNATE_LOGIN_URL || "/login"}
            onClick={this.handleOrgInviteClick}
          >
            Volunteer Login
          </a>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className={css(styles.container)}>
        <div className={css(styles.logoDiv)}>
          <img
            src="https://politics-rewired.surge.sh/spoke_logo.svg"
            className={css(styles.logoImg)}
          />
        </div>
        <div className={css(styles.content)}>{this.renderContent()}</div>
      </div>
    );
  }
}

Home.propTypes = {
  mutations: PropTypes.shape({
    createInvite: PropTypes.func.isRequired
  }).isRequired,
  history: PropTypes.object.isRequired,
  data: PropTypes.object.isRequired
};

const queries = {
  data: {
    query: gql`
      query getCurrentUser {
        currentUser {
          id
          adminOrganizations: organizations(role: "ADMIN") {
            id
          }
          superVolOrganizations: organizations(role: "SUPERVOLUNTEER") {
            id
          }
          ownerOrganizations: organizations(role: "OWNER") {
            id
          }
          texterOrganizations: organizations(role: "TEXTER") {
            id
          }
        }
      }
    `
  }
};

const mutations = {
  createInvite: ownProps => invite => ({
    mutation: gql`
      mutation createInvite($invite: InviteInput!) {
        createInvite(invite: $invite) {
          hash
        }
      }
    `,
    variables: { invite }
  })
};

export default compose(
  loadData({ queries, mutations }),
  withRouter
)(Home);
