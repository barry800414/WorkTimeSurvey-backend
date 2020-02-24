const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const request = require("supertest");
const ObjectId = require("mongodb").ObjectId;
const { connectMongo } = require("../models/connect");

chai.use(require("chai-subset"));
chai.use(chaiAsPromised);

const { assert, expect } = chai;
const app = require("../app");

const { FakeUserFactory } = require("../utils/test_helper");

describe("Query popular_experiences", () => {
    let db;

    before(async () => {
        ({ db } = await connectMongo());
    });

    before(() =>
        db.collection("experiences").insertMany([
            {
                created_at: new Date(),
                type: "work",
                title: "ugly",
                sections: [
                    {
                        content: "我很醜",
                    },
                ],
                status: "published",
                archive: {
                    is_archived: false,
                },
            },
            {
                created_at: new Date(),
                type: "work",
                title: "gentle",
                sections: [
                    {
                        content: "可是我很溫柔",
                    },
                ],
                status: "published",
                archive: {
                    is_archived: false,
                },
            },
            {
                created_at: new Date(),
                type: "work",
                title: "cold",
                sections: [
                    {
                        content: "外表冷漠",
                    },
                ],
                status: "published",
                archive: {
                    is_archived: false,
                },
            },
            {
                created_at: new Date(new Date() - 100 * 24 * 60 * 60 * 1000),
                type: "work",
                title: "hot",
                sections: [
                    {
                        content: "內心狂熱",
                    },
                ],
                status: "published",
                archive: {
                    is_archived: false,
                },
            },
        ])
    );

    it("will return experiences in thirty days", async () => {
        const payload = {
            query: `{
                    popular_experiences(returnNumber: 4, sampleNumber: 4) {
                        id
                        title
                    }
                }`,
            variables: null,
        };
        const res = await request(app)
            .post("/graphql")
            .send(payload)
            .expect(200);

        const { popular_experiences } = res.body.data;

        assert.isArray(popular_experiences);
        assert.lengthOf(popular_experiences, 3);
        expect(popular_experiences).containSubset([{ title: "cold" }]);
        expect(popular_experiences).to.not.containSubset([{ title: "hot" }]);
    });

    it("will experiences with most number of words", async () => {
        const payload = {
            query: `{
                    popular_experiences(returnNumber: 2, sampleNumber: 2) {
                        id
                        title
                    }
                }`,
            variables: null,
        };
        const res = await request(app)
            .post("/graphql")
            .send(payload)
            .expect(200);

        const { popular_experiences } = res.body.data;

        assert.isArray(popular_experiences);
        assert.lengthOf(popular_experiences, 2);
        expect(popular_experiences).containSubset([{ title: "cold" }]);
        expect(popular_experiences).containSubset([{ title: "gentle" }]);
    });

    after(async () => {
        return db.collection("experiences").deleteMany({});
    });
});

function generateWorkExperiencePayload(options) {
    const opt = options || {};
    const valid = {
        company: {
            query: "00000001",
        },
        region: "臺北市",
        job_title: "job_title_example",
        title: "title_example",
        sections: [
            {
                subtitle: "subtitle1",
                content: "content1",
            },
        ],
        experience_in_year: 10,
        education: "大學",
        // Work Experience related
        is_currently_employed: "no",
        job_ending_time: {
            year: 2017,
            month: 4,
        },
        salary: {
            type: "year",
            amount: 10000,
        },
        week_work_time: 40,
        recommend_to_others: "yes",
        email: "test@goodjob.org",
    };

    const payload = {};
    for (const key in valid) {
        if (opt[key]) {
            if (opt[key] !== -1) {
                payload[key] = opt[key];
            }
        } else {
            payload[key] = valid[key];
        }
    }
    for (const key in opt) {
        if (opt[key] !== -1) {
            payload[key] = opt[key];
        }
    }

    return {
        query: `
            mutation CreateWorkExperience($input: CreateWorkExperienceInput!) {
                createWorkExperience(input: $input) {
                    success
                    experience {
                        id
                        type
                        company {
                            name
                        }
                        job_title {
                            name
                        }
                        region
                        experience_in_year
                        education
                        salary {
                            type
                            amount
                        }
                        title
                        sections {
                            subtitle
                            content
                        }
                        created_at
                        reply_count
                        report_count
                        like_count
                        status

                        liked
                        data_time {
                            year
                            month
                        }
                        week_work_time
                        recommend_to_others
                    }
                }
            }
        `,
        variables: {
            input: payload,
        },
    };
}

describe.only("mutation CreateWorkExperience", () => {
    let db;
    const fake_user_factory = new FakeUserFactory();
    const fake_user = {
        _id: new ObjectId(),
        facebook_id: "-1",
        facebook: {
            id: "-1",
            name: "markLin",
        },
    };
    const API_ENDPOINT = "/graphql";

    before(async () => {
        ({ db } = await connectMongo());
    });

    describe("POST /work_experiences", () => {
        let fake_user_token;

        before("Seed companies", () =>
            db.collection("companies").insertMany([
                {
                    id: "00000001",
                    name: "GOODJOB",
                },
                {
                    id: "00000002",
                    name: "GOODJOBGREAT",
                },
                {
                    id: "00000003",
                    name: "GOODJOBGREAT",
                },
            ])
        );

        beforeEach(async () => {
            await fake_user_factory.setUp();
        });

        beforeEach("Create some users", async () => {
            fake_user_token = await fake_user_factory.create(fake_user);
        });

        afterEach(async () => {
            await fake_user_factory.tearDown();
        });

        it("should success", async () => {
            const res = await request(app)
                .post(API_ENDPOINT)
                .send(generateWorkExperiencePayload())
                .set("Authorization", `Bearer ${fake_user_token}`)
                .expect(200);

            const resData = res.body.data.createWorkExperience;

            const experience = await db
                .collection("experiences")
                .findOne({ _id: ObjectId(resData.experience.id) });

            // expected fields in db
            assert.equal(experience.type, "work");
            assert.deepEqual(experience.author_id, fake_user._id);
            assert.deepEqual(experience.company, {
                id: "00000001",
                name: "GOODJOB",
            });
            assert.equal(experience.region, "臺北市");
            assert.equal(experience.job_title, "JOB_TITLE_EXAMPLE");
            assert.equal(experience.title, "title_example");
            assert.deepEqual(experience.sections, [
                {
                    subtitle: "subtitle1",
                    content: "content1",
                },
            ]);
            assert.equal(experience.experience_in_year, 10);
            assert.equal(experience.education, "大學");
            assert.equal(experience.is_currently_employed, "no");
            assert.deepEqual(experience.job_ending_time, {
                year: 2017,
                month: 4,
            });
            assert.deepEqual(experience.salary, {
                type: "year",
                amount: 10000,
            });
            assert.equal(experience.week_work_time, 40);
            assert.equal(experience.recommend_to_others, "yes");
            assert.deepEqual(experience.like_count, 0);
            assert.deepEqual(experience.reply_count, 0);
            assert.deepEqual(experience.report_count, 0);
            assert.property(experience, "created_at");
            assert.property(experience, "data_time");
            assert.deepEqual(experience.status, "published");

            assert.equal(experience.archive.is_archived, false);
            assert.equal(experience.archive.reason, "");

            const user = await db
                .collection("users")
                .findOne({ _id: fake_user._id });
            assert.equal(user.subscribeEmail, true);
            assert.equal(user.email, experience.email);

            // expected response
            assert.property(resData, "success");
            assert.equal(resData.success, true);
            assert.deepProperty(resData, "experience.id");
        });

        describe("Common Data Validation Part", () => {
            it("company_query or company_id is required", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            company: {
                                query: -1,
                                id: -1,
                            },
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(200));

            it("region is required", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            region: -1,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(400));

            it.only("region is illegal Field, expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            region: "你好市",
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(200));

            for (const input of ["新北市", "臺南市", "新竹市"]) {
                it(`region should be ${input}`, async () => {
                    const res = await request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                region: input,
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(200);

                    const experience = await db
                        .collection("experiences")
                        .findOne({
                            _id: ObjectId(res.body.experience.id),
                        });

                    assert.equal(experience.region, input);
                });
            }

            it("job_title is required", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            job_title: -1,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("title is required", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            title: -1,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("title of word is more than 50 char , expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            title: new Array(60).join("今"),
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("sections is empty, expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            sections: null,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("sections is not array, expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            sections: "abcdef",
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("subsection of title and content is empty, expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            sections: [
                                {
                                    subtitle: null,
                                    content: null,
                                },
                            ],
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("subsection of title is undefined, expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            sections: [
                                {
                                    subtitle: undefined,
                                    content: "I am content",
                                },
                            ],
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("subsection of title is null, expected return 200", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            sections: [
                                {
                                    subtitle: null,
                                    content: "I am content",
                                },
                            ],
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(200));

            it("subtitle of word is more than 25 char, expected return 422", () => {
                const words = new Array(40).join("慘");
                return request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            sections: [
                                { subtitle: words, content: "喝喝面試官" },
                            ],
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422);
            });

            it("subcontent of word is more then 5000 char, expected return 422", () => {
                const sendData = generateWorkExperiencePayload();
                const words = new Array(6000).join("好");
                sendData.sections[0].content = words;
                return request(app)
                    .post(API_ENDPOINT)
                    .send(sendData)
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422);
            });

            it("experience_in_year should not be a valid number", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            experience_in_year: "test",
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("experience_in_year should be 0~50", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            experience_in_year: 51,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("education is illegal , expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            education: "無業遊名",
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("email format is invalid , expected return 422", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            email: "goodjob@ gmail.",
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            for (const input of ["大學", "高中", "國中"]) {
                it(`education could be ${input}`, async () => {
                    const res = await request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                education: input,
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(200);

                    const experience = await db
                        .collection("experiences")
                        .findOne({
                            _id: ObjectId(res.body.experience.id),
                        });

                    assert.equal(experience.education, input);
                });
            }
        });

        describe("Work Validation Part", () => {
            it("is_currently_employed is required", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            is_currently_employed: -1,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it('job_ending_time is required if is_currently_employed is "no"', () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            is_currently_employed: "no",
                            job_ending_time: -1,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            describe("job_ending_time should be reasonable", () => {
                it("job_ending_time.year sould be number", () =>
                    request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                job_ending_time: {
                                    year: "2017",
                                    month: 3,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422));

                it("job_ending_time.month sould be number", () =>
                    request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                job_ending_time: {
                                    year: 2017,
                                    month: "3",
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422));

                it("job_ending_time.year <= this year", () => {
                    const nextYear = new Date();
                    nextYear.setFullYear(nextYear.getFullYear() + 1);
                    return request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                job_ending_time: {
                                    year: nextYear.getFullYear(),
                                    month: 3,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422);
                });

                it("job_ending_time.year > this year - 10", () =>
                    request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                job_ending_time: {
                                    year: new Date().getFullYear() - 10,
                                    month: 3,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422));

                it("job_ending_time.month should be 1~12", () =>
                    request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                job_ending_time: {
                                    year: 2017,
                                    month: 13,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422));

                it("job_ending_time <= now", () => {
                    const now = new Date();

                    return request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                job_ending_time: {
                                    year: now.getFullYear(),
                                    month: now.getMonth() + 2,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422);
                });
            });

            describe("salary should be reasonable", () => {
                it('salary type should in ["year","month","day","hour"]', () =>
                    request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                salary: {
                                    type: "hooooo",
                                    amount: 10000,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422));

                it("salary amount is number required", () =>
                    request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                salary: {
                                    type: "year",
                                    amount: "hohohoho",
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422));

                it("salary amount should be positive number", () =>
                    request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                salary: {
                                    type: "year",
                                    amount: -1000,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(422));
            });

            it("week_work_time should be number", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            week_work_time: "one",
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it("week_work_time should be positive number", () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            week_work_time: -10,
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            it('recommend_to_others should be ["yes", "no"]', () =>
                request(app)
                    .post(API_ENDPOINT)
                    .send(
                        generateWorkExperiencePayload({
                            recommend_to_others: "don't know",
                        })
                    )
                    .set("Authorization", `Bearer ${fake_user_token}`)
                    .expect(422));

            describe("data_time should be reasonable", () => {
                it('data_time\'s year & month should be today if is_currently_employed is "yes"', async () => {
                    const res = await request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                is_currently_employed: "yes",
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(200);

                    const experience = await db
                        .collection("experiences")
                        .findOne({
                            _id: ObjectId(res.body.experience.id),
                        });

                    const now = new Date();
                    assert.deepEqual(experience.data_time, {
                        year: now.getFullYear(),
                        month: now.getMonth() + 1,
                    });
                });

                it('data_time should be job_ending_time if is_currently_employed is "no"', async () => {
                    const res = await request(app)
                        .post(API_ENDPOINT)
                        .send(
                            generateWorkExperiencePayload({
                                is_currently_employed: "no",
                                job_ending_time: {
                                    year: 2017,
                                    month: 4,
                                },
                            })
                        )
                        .set("Authorization", `Bearer ${fake_user_token}`)
                        .expect(200);

                    const experience = await db
                        .collection("experiences")
                        .findOne({
                            _id: ObjectId(res.body.experience.id),
                        });

                    assert.deepEqual(experience.data_time, {
                        year: 2017,
                        month: 4,
                    });
                });
            });
        });

        describe("user not login", () => {
            it("should return 401 Unauthorized", () => {
                const sendData = generateWorkExperiencePayload();
                return request(app)
                    .post(API_ENDPOINT)
                    .send(sendData)
                    .expect(401);
            });
        });

        after(async () => {
            await db.collection("experiences").deleteMany({});
            await db.collection("companies").deleteMany({});
        });
    });
});
