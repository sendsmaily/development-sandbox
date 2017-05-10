# Dockerizing development environments

An example project built for tech talk at [Python Codeclub](http://codeclub.thorgate.eu/about).

#### A few words of warning...

> There is no Docker way to build your local development environment. I built an (awesome) Frankenstein and it works. You can too.
>
> -- Jeff Nickoloff

This pattern is just one possible take on dockerizing a web application's development environment. The containerization approach taken here is somewhat opinionated, designed around our workflow, tooling and project structure at [Smaily](https://smaily.com). Your needs will differ, so don't take this example as an absolute truth on dos and don'ts.

The example application used for demo purposes is a simple [React](https://facebook.github.io/react/) based TODO app backed by a RESTful web API built on top of the awesome [Django REST Framework](http://django-rest-framework.org). Do note the demo application is a quickly slapped together example to get something running in the containers with minimal configuration and external dependencies overhead, and is not an example of industry's best practices. You can (and should) do better in real world projects.

## Table of contents

* [Using it](#using-it)
    * [Setting up](#setting-up)
    * [Operating the sandbox](#operating-the-sandbox)
* [The design](#the-design)
    * [Sandbox's structure](#sandboxs-structure)
    * [Network configuration](#network-configuration)
    * [Bind mounts](#bind-mounts)
    * [Management script](#management-script)
        * [Available sub-commands](#available-sub-commands)
    * [Shell interface](#shell-interface)
* [The ugly](#the-ugly)
    * [IDE integration](#ide-integration)
    * [Sterility issues](#sterility-issues)
    * [In-container user management](#in-container-user-management)
    * [Tricky container running](#tricky-container-running)
* [Applying the pattern at scale](#applying-the-pattern-at-scale)

## Using it

Sandbox depends on [Docker Engine](https://docs.docker.com/engine/) and [Docker Compose](https://docs.docker.com/compose/overview/). Installing required dependencies is out of scope for this document. Use official instructions for setting up Docker Engine [here](https://docs.docker.com/engine/installation/) and Docker Compose [here](https://docs.docker.com/compose/install/).

> Pro tip: when Python is your poison, use `pip` for `docker-compose`.

> The sandbox will run out-of-the-box only on Linux machines with Gnome (or Gnome-derived) desktop environments due to a dependency on `gnome-terminal`.

### Setting up

Start by cloning the project's repository:

    $ git clone https://github.com/sendsmaily/development-sandbox

Then add following line to your `/etc/hosts` file for well-known development hostnames:

    172.30.255.254  api.development.sandbox app.development.sandbox

> The sandbox runs on `172.30.0.1/16` subnet, with [Traefik](https://traefik.io/) proxying the HTTP requests, statically bound to `172.30.255.254` IPv4 address. See [Network configuration](#network-configuration) section for more information on this.

That's all! You have a fully functional development environment.

### Operating the sandbox

You interact with sandbox using its `sandbox` management script in the project's root. It is a wrapper around Docker and Docker Compose's commands, providing a high level interface to interacting with the stack.

> To get inline help on available sub-commands, invoke the script with no arguments: `$ ./sandbox`, or pass the `help` argument: `$ ./sandbox help`

Change into the project's directory you checked out earlier and run the build:

    $ cd /path/to/the/development-sandbox
    $ ./sandbox build

When the build completes, bring up the sandbox:

    $ ./sandbox up

You'll see some log output and then new terminal window with multiple tabs should pop up.

> When you see an empty terminal tab, just hit any key. Docker has some issues syncing the shell output when terminal is attached to the container.

You're up and running!

To start the application, you first have to install the dependencies and set up the database.

Pick web app's tab from the sandbox's terminal window, install the dependencies and start the development server:

    $ npm install
    $ npm start

Pick web API's tab from the sandbox's terminal window, install the dependencies, apply database migrations and start the development server:

    $ pip install -r requirements.txt
    $ ./manage.py migrate
    $ ./manage.py runserver 0.0.0.0:8000

You should be good to go! Navigate to [http://app.development.sandbox/](http://app.development.sandbox/) and enjoy the containerized experience.

> Data in the database and services' dependencies are stored on the host machine, and thus will persist across subsequent runs. See the [Bind mounts](#bind-mounts) section for more information on this.

## The design

This section describes the key points of sandbox's design and explains the reasoning behind these decisions.

### Sandbox's structure

Sandbox follows a standardized directory structure.

```
└── sandbox
    ├── .data
    |   └── ...
    ├── service
    |   ├── .sandbox
    |   |   └── ...
    |   ├── Dockerfile.sandbox
    |   └── ...
    ├── service
    |   └── ...
    ├── docker-compose.sandbox.yml
    ├── sandbox
    └── ...
```

> To differentiate between development and production image declarations we use `.sandbox` suffix on the development `Dockerfile`-s.

The sandbox's backbone is `docker-compose.sandbox.yml` file, which defines:
* services and their runtime configuration,
* services' build configuration (if applicable), and
* sandbox's network configuration.

Each service requiring custom build and/or runtime configuration resides in its own project directory, which contains everything from its `Dockerfile` and configuration to application code.

> Note that some services (MySQL, MongoDB, Redis, etc.) can usually be run straight off of images from Docker Hub and don't require any specialized set up.

In addition to `Dockerfile.sandbox`, we've implemented a common pattern of using `.sandbox` directory in service's root directory for sandbox specific scripts and runtime configuration. For example, if we wanted to customize container's entrypoint logic in sandbox, or use some additional sandbox specific helper scripts, or override configuration for some service, then `.sandbox` directory is the place for that. See [`load-balancer`](https://github.com/sendsmaily/development-sandbox/tree/master/load-balancer/.sandbox/) service as an example of this.

To bake the `.sandbox` directory's contents into image, we just recursively copy said directory to `/usr/local` during build:

```Dockerfile
COPY .sandbox /usr/local
```

> Quick side note: we use the exact same pattern for production images as well. The only difference being the local directory which is named `.production`.

Last but no least, we're making use of specialized `.data` directory for persisting containers' state across different sandbox sessions. Also see [Bind mounts](#bind-mounts) for more information on this.

Containers are by design stateless and all the data they have accumulated during run will be lost when the container is destroyed. This will become a problem first and foremost with development databases, where you might not want to be left with blank database every time you recreate the containers.

### Network configuration

An important Docker feature we're making heavy use of is its networking stack which enables all sorts of awesome.

Each Docker container launched gets a private IP address.

For example `web-api` container:

    $ smaily@web-api:/srv/application$ ip addr show eth0
    ...
    inet 172.30.0.3/16 scope global eth0
    ...

And `web-app` container:

    $ smaily@web-app:/srv/application$ ip addr show eth0
    ...
    inet 172.30.0.2/16 scope global eth0
    ...

We're using these private IP addresses to communicating with containers instead of relying on exposing ports which will get really hairy really fast when the number of containers you need to expose starts to rise (`localhost`, `localhost:81`, `localhost:8000`, `localhost:8080`, `localhost:8081`, anyone?).

To make these private addresses actually useful, we assign key containers (such as an HTTP proxy) well-known IP addresses, and map these addresses to routable names in `/etc/hosts` file. This provides a really nice human friendly interface to interacting with the project. And no port clashing!

Relevant parts in `docker-compose.sandbox.yml` file:

```yml
networks:
  default:
    driver: bridge
    ipam:
      config:
        - subnet: '172.30.0.0/16'

services:
  load-balancer:
  ...
  networks:
    default:
      ipv4_address: '172.30.255.254'
  ...
```

And in `/etc/hosts` file:

```
...
172.30.255.254  api.development.sandbox app.development.sandbox
...
```

> Alternative approach to making these names routable is configuring your host's DNS server. Pick your poison.

For inter-container networking we leverage Docker's built-in DNS server and use name based routing, which allows us to use well-known identifiers for addresses without caring what the actual address of the container might be, or worse trying to do some network introspection to determine IP addresses and injecting them during start up.

Name resolution using service name:

    $ smaily@web-app:/srv/application$ getent hosts web-api
    172.30.0.3      web-api

Name resolution using container name:

    $ smaily@web-app:/srv/application$ getent hosts developmentsandbox_web-api_1
    172.30.0.3      developmentsandbox_web-api_1

> Pro tip: Docker also allows specifying [network aliases](https://docs.docker.com/compose/compose-file/#aliases) to containers, which allows you to reference your containers from within the network with whatever names you please.

### Bind mounts

To further streamline the developer experience, we're making heavy use of Docker for:
* injecting application codebase into containers,
* persisting databases across sandbox sessions, and
* injecting application package dependencies into containers.

Containers' volumes are specified in `docker-compose.sandbox.yml`:

```yml
services:
  ...
  web-api:
    ...
    volumes:
      - ./web-api:/srv/application
      - ./.data/packages:/srv/packages
  ...
```

Mounting application codebase into containers allows us to avoid rebuilding the container after each code change.

Another use for volumes we've found is persisting databases across sandbox sessions. Since containers are stateless - i.e. when container is destroyed, the data it has accumulated is lost - we needed a mechanism for it to survive sandbox rebuilds. This is done by mounting database's data directory to host. Using MongoDB as an example, we mount `/data/db` to project's `.data/mongodb` directory. Also read about its [downsides](#sterility-issues).

We're also using volumes to mount application's (Python) dependencies into containers. This is purely to get basic IDE integration (i.e. code completion) for our containerized development environment. See [IDE integration](#ide-integration) for more thoughts on the topic.

### Management script

The sandbox is managed by Docker Compose only, which provides clean high-level interface via Compose file and its CLI, although we don't use it directly to interact with the stack. Instead we have interfaced it through management script to further streamline the management UI.

Main design decision behind implementing a management script is to hide away the somewhat complex command interface by doing some basic shell environment setup and automating recurring and/or logically bound together tasks.

Besides running the sandbox, as is the case with this example project, you could also use the management script for any other maintenance task on sandbox - flushing databases and repopulating them from fixtures, flushing caches, updating your codebase to latest `HEAD`, etc. Whatever your exact requirements might be.

#### Available sub-commands

Management script provides the following interface for managing the sandbox:
* `build [SERVICE]` - builds the sandbox's images, cleans up after itself by removing untagged images created by the build. Wrapper around `docker-compose build`.
Arguments passed to command are forwarded to `docker-compose build`.
* `clean` - cleans the environment. Removes created networks, stopped containers and untagged images.
Wrapper around `docker-compose down --remove-orphans` and `docker image prune -f`.
* `down [SERVICE]` - brings the sandbox down. Does not remove created networks or stopped containers. Wrapper around `docker-compose stop`. Arguments passed to command are forwarded to `docker-compose stop`.
* `exec SERVICE CMD` - runs a one-off command against service. Wrapper around `docker-compose exec`.
Arguments passed to command are forwarded to `docker-compose exec`.
* `logs [SERVICE]` - attaches to logs output. Useful for monitoring services the shell isn't automatically attached to.
* `up [SERVICE]` - brings the sandbox up and attaches sandbox shell. Wrapper around `docker-compose up`.
Arguments passed to command are forwarded to `docker-compose up`. `SERVICE` argument is useful when using `depends_on` feature.

### Shell interface

Shell interface was implemented to allow developers continue using (usually shell-based) workflows for different developer tools and frameworks. This involves managing dependencies, running development servers, running tests and linters.

## The ugly

#### IDE integration

Integrating your favorite IDE with containerized development environment is problematic.

When talking on the example of Python, then there are means of running remote interpreters containerized: (for example [Sublime Text 3](https://github.com/DamnWidget/anaconda/wiki/Anaconda-v2:-Using-a-remote-python-interpreter-through-Docker), [PyCharm](https://www.jetbrains.com/help/pycharm/2017.1/configuring-remote-interpreters-via-docker.html)), but it is still kind of hit and miss when your project extends beyond a single container.

The main problems with remote interpreters on multi-container projects are:
* each container requires its own interpreter server,
* each interpreter requires a well known endpoint, so that you could configure your IDE to use it;
* essentially each service must become a separate project with separate configuration, since no IDE supports running directory-level interpreters.

We have worked around this by
* running the same Python interpreter versions on developer machines as we are in containers,
* using a single Python packages volume for all of our Python containers to get basic code completion,
* when debugging the code, we're setting the breakpoints manually:
```python
...
import pdb; pdb.set_trace()
...
```
* and we have built good shell script based tooling for automatic quality checks.

> Also check out [`development-sandbox.sublime-project`](https://github.com/sendsmaily/development-sandbox/blob/master/development-sandbox.sublime-project) for an example Sublime Text 3 with [Anaconda](http://damnwidget.github.io/anaconda/) configuration.

#### Sterility issues

We have made compromises in keeping the sandbox sterile to improve the developer experience for the project. The sterility issues manifest themselves mainly as the sandbox being in not thoroughly predictable state when commit X is checked out. This is due to two necessities:
* using the host mounted packages directory (see [IDE integration](#ide-integration) for reasoning), and
* persisting the development databases on host.

Cross-using a single packages directory will mainly introduce problems with undeclared and/or deprecated dependencies resulting in import errors, but it also prevents us from using different versions of packages for different containers in development. This isn't a problem for us, since we have a common policy to keep version drift to minimum across stack, but it might be for you.

Persisting the development databases can possibly cause database schema drifts between developers and/or production which in turn can result in unapplicable or just plain potentially destructive database migrations.

In general, these problems should be picked out by CI pipeline, when imports or database queries start to fail, and from our experience, on 99.9% of cases they are. But we still recommend our developers to flush the data persistence directory every couple of weeks to reduce the probability of running into any issues.

#### In-container user management

Mounting the application codebase into containers introduces requirement to start mapping local users to container's. This is due to fact that processes in containers are not run as your host user. For example, when you run as `root` in the container (you shouldn't!),
all files and directories created on volumes will be mapped to `root` user on host.

This won't be a problem when persisting database data locally, but it will become an issue when you start working on your application's codebase.

In-container user management is handled during container build in service's `Dockerfile`:

```Dockerfile
...
ARG user_id
ARG user_name
ARG group_id
ARG group_name
...
RUN groupadd -g ${group_id} ${group_name} \
    && useradd -m -u ${user_id} -g ${group_id} $user_name -s /bin/bash
...
```

The build arguments are passed in from `docker-compose.sandbox.yml`:

```yml
...
services:
  web-api:
    build:
      ...
      args:
        user_id: ${SANDBOX_USER_ID}
        user_name: ${SANDBOX_USER_NAME}
        group_id: ${SANDBOX_GROUP_ID}
        group_name: ${SANDBOX_GROUP_NAME}
  ...
```

And specified in `sandbox` management script:

```bash
...
export SANDBOX_USER_ID=$(id -u)
export SANDBOX_GROUP_ID=$(id -g)
export SANDBOX_USER_NAME=$(id -un)
export SANDBOX_GROUP_NAME=$(id -gn)
...
```

> Also check out web app's user creation logic [here](https://github.com/sendsmaily/development-sandbox/blob/master/web-app/Dockerfile.sandbox#L9-L12) which requires us to modify already existing user to recreate the host user in container.

#### Tricky container running

Since we have built the sandbox around in-container [shell interface](#shell-interface), the container launching logic has become somewhat awkward.

For example launching a `web-app` container implies specifying the container with following flags:

```yml
services:
  ...
  web-app:
    ...
    entrypoint: /bin/bash
    ...
    stdin_open: true
    tty: true
```

and attaching to the container with following command:

    $ docker attach --sig-proxy=false [ID of the web app container]

Whereas launching the `database` container implies starting it and executing:

    $ docker exec -it [ID of the database container] /bin/bash

The difference created here is due to the fact that container (or any other Linux machine for that matter) exits when its main process exits. For `web-app` container the main process will become `/bin/bash`. To prevent `bash` from exiting right after start up, we have to flag the container to keep the `stdin` open (`tty` flag is for enabling pseudo-TTY on the container).

For database container, the main process is the `mysql` server, and by `exec`-ing `/bin/bash` we're creating just another process in the container we're binding to.

Alternative to the `stdin` and `tty` trickery would be to run some simple blocking program as the main process, and `exec`-ing your way into the container as with the database example.

## Applying the pattern at scale

Current project demos the pattern on a simple project, but with few additional tweaks we have implemented it on a development sandbox running around 30 (and counting) services.

#### Implement the sandbox as an umbrella project

Use the sandbox as an umbrella project with each service in its own repository. Git submodules, git subtrees or just checking service repos out into `sandbox` directory (as we do), whatever suits you.

You can achieve this fairly simply by refactoring current pattern and moving service specific compose configuration to the services's repository:

```
├── docker-compose.sandbox.yml
├── service
|   ├── ...
|   ├── service.sandbox.yml
|   └── Dockerfile.sandbox
├── service
|   ├── ...
|   ├── service.sandbox.yml
|   └── Dockerfile.sandbox
└── ...
```

Next extend the `docker-compose.sandbox.yml` file with split out service specification files in project repositories:

```yml
services:
  ...
  web-api:
    extends:
      file: web-api/service.sandbox.yml
      service: web-api

  web-app:
    extends:
      file: web-app/service.sandbox.yml
      service: web-app
  ...
```

> Although, do note the [limitation on extending services](https://docs.docker.com/compose/extends/#extending-services): version 3.x does not support extends yet.

Alternative option is to use [multiple compose files](https://docs.docker.com/compose/extends/#multiple-compose-files) by modifying the `sandbox` management script:

```bash
...
function _stack() {
    docker-compose \
        --project-name ${SANDBOX_PROJECT_NAME} \
        --file docker-compose.sandbox.yml \
        --file web-api/service.sandbox.yml \
        --file web-app/service.sandbox.yml \
        "${@:1}"
}
...
```

#### Implement reusable base images for your services.

When you start going against the DRY principle when declaring your images and containers,
start implementing common base images. For example we're running all of our Python based images off of same base image with common application logic (core modules as we call them) and common dependencies across stack baked into the image.

This plays nice with DRY principle, and it also makes your deployments more efficient by allowing core dependencies to be downloaded only once and letting every other deployed service reuse those dependencies from base image.

#### Implement sub-stacks

When your stack is starting to get too large to comfortably work on, start implementing sub-stacks, i.e. start running only that very specific part of your application you intend to work on.

This can be done by either creating different base compose files or by introducing inter-service dependency links using Compose file's `depends_on` service attribute:

```yml
services:
  cache:
    ...

  database:
    ...

  web-api:
    ...
    depends_on:
     - database

  web-app:
    ...
    depends_on:
     - web-api
  ...

  worker:
    ...
    depends_on:
     - cache
     - database
```

> Pro tip: `depends_on` is also very useful for introducing build order dependencies.

This allows developers to spin up only the required part of whole stack they intend to work on.

For example. When the developer needs to work on `worker` service, they don't need `web-api` or
`web-app` services. So, they can simply use `./sandbox up worker`, which will spin up only `worker`, `cache` and `database` services, specified by the inter-service dependency links.

The same applies to working on `web-app`. Issuing `./sandbox up web-app` will spin up `web-app`, `web-api` and `database` services.
