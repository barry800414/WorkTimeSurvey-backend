const { gql } = require("apollo-server-express");
const escapeRegExp = require("lodash/escapeRegExp");

const Type = gql`
    type Company {
        name: String!

        "取得資料本身"
        salary_work_times: [SalaryWorkTime!]!
        work_experiences(start: Int, limit: Int): [WorkExperience!]!
        interview_experiences(start: Int, limit: Int): [InterviewExperience!]!

        "取得統計資訊"
        salary_work_time_statistics: SalaryWorkTimeStatistics!
        work_experience_statistics: WorkExperienceStatistics!
        interview_experience_statistics: InterviewExperienceStatistics!

        "該公司內不同職業的平均薪資"
        average_salaries: [AverageSalary!]
    }
`;

const Query = gql`
    extend type Query {
        search_companies(query: String!): [Company!]!
        company(name: String!): Company

        "目前用途：取得薪資資料前 topN 多的公司，且至少有三種職稱各至少有三筆資料"
        popular_companies(limit: Int = 5): [Company!]!
    }
`;

const Mutation = `
`;

const resolvers = {
    Query: {
        async search_companies(_, { query: company }, ctx) {
            const collection = ctx.db.collection("workings");

            // FIXME: should query from collection `companies`
            const results = await collection
                .aggregate([
                    {
                        $match: {
                            status: "published",
                            "archive.is_archived": false,
                            "company.name": new RegExp(
                                escapeRegExp(company.toUpperCase())
                            ),
                        },
                    },
                    {
                        $group: {
                            _id: "$company",
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            id: "$_id.id",
                            name: "$_id.name",
                        },
                    },
                ])
                .toArray();

            return results;
        },

        company: async (_, { name }, ctx) => {
            const salaryWorkTimeCollection = ctx.db.collection("workings");
            const experienceCollection = ctx.db.collection("experiences");

            // 只要 salaryWorkTime / experiences 任一邊有出現，就不會回傳 null
            const companyFromSalaryWorkTime = await salaryWorkTimeCollection.findOne(
                {
                    status: "published",
                    "archive.is_archived": false,
                    "company.name": name,
                }
            );

            const companyFromExperience = await experienceCollection.findOne({
                status: "published",
                "archive.is_archived": false,
                "company.name": name,
            });

            if (companyFromSalaryWorkTime || companyFromExperience) {
                return { name };
            } else {
                return null;
            }
        },
        popular_companies: async (_, { limit }, ctx) => {
            const topCompanies = await ctx.db
                .collection("workings")
                .aggregate([
                    {
                        $group: {
                            _id: "$company.name",
                            count: { $sum: 1 },
                        },
                    },
                    {
                        $sort: { count: -1 },
                    },
                    {
                        $limit: limit,
                    },
                ])
                .toArray();
            return topCompanies.map(e => ({ name: e._id }));
        },
    },
    Company: {
        salary_work_times: async (company, _, { manager }) => {
            return await manager.SalaryWorkTimeModel.byCompanyLoader.load(
                company.name
            );
        },
        salary_work_time_statistics: async (company, _, { manager }) => {
            return await manager.SalaryWorkTimeModel.byCompanyLoader.load(
                company.name
            );
        },
        work_experiences: async (company, _, { manager }) => {
            return await manager.WorkExperienceModel.byCompanyLoader.load(
                company.name
            );
        },
        interview_experiences: async (company, _, { manager }) => {
            return await manager.InterviewExperienceModel.byCompanyLoader.load(
                company.name
            );
        },
        work_experience_statistics: () => {},
        interview_experience_statistics: () => {},

        average_salaries: async (company, _, ctx) => {
            const results = await ctx.db
                .collection("workings")
                .aggregate([
                    {
                        $match: {
                            "company.name": company.name,
                        },
                    },
                    {
                        $group: {
                            _id: { jobTitle: "$job_title" },
                            avg_salary: { $avg: "$estimated_hourly_wage" },
                            count: { $sum: 1 },
                        },
                    },
                    {
                        $sort: { count: -1 },
                    },
                    {
                        $limit: 5,
                    },
                ])
                .toArray();

            return results.map(e => ({
                company: { name: company.name },
                job_title: { name: e._id.jobTitle },
                data_count: e.count,
                salary: {
                    amount: parseInt(e.avg_salary),
                    type: "hour",
                },
            }));
        },
    },
};

const types = [Type, Query, Mutation];

module.exports = {
    resolvers,
    types,
};
