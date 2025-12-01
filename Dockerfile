FROM node:20
WORKDIR "/app"

# Copy package.json and package-lock.json
COPY package.json ./
#COPY .npmrc .npmrc

#RUN npm config fix

#RUN npm install --production

RUN npm i --force
FROM node:20-slim

WORKDIR "/app"
COPY ./cert/fullchain.pem /etc/ssl/certs/
COPY ./cert/privkey.pem /etc/ssl/private/

# Install app dependencies
COPY --from=0 /app/node_modules /app/node_modules
COPY . /app


CMD ["npm", "run", "develop"]
