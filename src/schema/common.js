const { gql } = require("apollo-server-express");

const Type = gql`
    type YearMonth {
        year: Int!
        month: Int!
    }

    type Salary {
        type: SalaryType
        amount: Int
    }

    type YesNoOrUnknownCount {
        yes: Int!
        no: Int!
        unknown: Int!
    }

    enum SalaryType {
        year
        month
        day
        hour
    }
`;

const Query = "";

const Mutation = gql`
    input CompanyInput {
        id: String
        query: String!
    }

    input SalaryInput {
        type: SalaryType!
        amount: Float!
    }

    input JobEndingTimeInput {
        year: Int!
        month: Int!
    }

    enum IsCurrentEmployedType {
        yes
        no
    }
`;

const resolvers = {};

const types = [Type, Query, Mutation];

module.exports = {
    resolvers,
    types,
};
