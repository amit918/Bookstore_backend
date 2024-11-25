const { ApolloServer, gql } = require("apollo-server-express");
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

const typeDefs = gql`
  enum Role {
    LIBRARIAN
    STUDENT
  }

  type Book {
    id: Int
    title: String
    author: String
    available: Boolean
  }

  type User {
    id: Int
    email: String
    role: Role
  }

  type Rental {
    id: Int
    user: User
    book: Book
    rentDate: String
    returnDate: String
  }

  type Query {
    books: [Book]
    rentals: [Rental]
    users: [User]
  }

  type Mutation {
    addBook(title: String, author: String): Book
    updateBook(id: Int, title: String, author: String): Book
    deleteBook(id: Int): Boolean
    rentBook(bookId: Int, userId: Int): Rental
    returnBook(rentalId: Int): Rental
    signup(email: String!, password: String!, role: Role!): User
    login(email: String!, password: String!): User
  }
`;

const resolvers = {
  Query: {
    books: async () => {
      return await prisma.book.findMany();
    },
    rentals: async () => {
      return await prisma.rental.findMany();
    },
    users: async () => {
      return await prisma.user.findMany();
    },
  },
  Mutation: {
    signup: async (_, { email, password, role }) => {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new Error("User already exists");
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
        },
      });

      return newUser;
    },

    login: async (_, { email, password }) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error("User not found");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error("Invalid password");
      }

      return user;
    },
    addBook: async (_, { title, author }) => {
      return await prisma.book.create({
        data: { title, author, available: true },
      });
    },
    updateBook: async (_, { id, title, author }) => {
      return await prisma.book.update({
        where: { id },
        data: { title, author },
      });
    },
    deleteBook: async (_, { id }) => {
      await prisma.book.delete({ where: { id } });
      return true;
    },
    rentBook: async (_, { bookId, userId }) => {
      const book = await prisma.book.findUnique({ where: { id: bookId } });
      if (!book || !book.available) throw new Error("Book is not available");

      return await prisma.rental.create({
        data: {
          bookId,
          userId,
        },
      });
    },
    returnBook: async (_, { rentalId }) => {
      const rental = await prisma.rental.update({
        where: { id: rentalId },
        data: {
          returnDate: new Date(),
        },
      });
      await prisma.book.update({
        where: { id: rental.bookId },
        data: { available: true },
      });
      return rental;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.start().then(() => {
  server.applyMiddleware({ app });

  app.listen(4000, () =>
    console.log("Server is running at http://localhost:4000/graphql")
  );
});
