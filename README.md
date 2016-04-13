# Timeliner

This is the main repo for Timeliner project
More info coming soon.

## Prerequisites

Please note that we will be using certain versions of base components and platforms and will not be actively handling cases when someone uses different ones. We target LTS (Long Term Support) ones if at all possible.

Using different PATCH version is possible MAJOR.MINOR.**PATCH** and should not raise any issues (this is even encouraged).
Using different MINOR version is also quite OK and has small possibility for issues being raised (depends on the component at hand; Angular bades code could have real issues even in cases when MINOR differs).

**NB! Possible issues and errors are anticipated if different MAJOR version is used.**

* Node.js - 4.x.x (4.4.3 is currently used)
* npm.js - 3.x. (3.8.6 is currently used)
* MongoDB - 3.2.x (3.2.3 is currently used)
* Angular.js - 1.5.x (1.5.3 is currently used)
* Socket.IO - 1.4.x (1.4.5 is currrently used)

## Development

### Verioning

We use [Semantic Versioning](http://semver.org). This should let release numbers explain the complexity of changes all by themselves.

**NB! This could be neglected during the early stages of development and only truly enforced once we hit the initial 1.0.0 fully features release.**

### Version control

The structure of the repository should have a **master** branch with most of the latest changes and new features that might not always be mature and stable, although it should not have unfinished code. It might also have some separate branches for any of the bigger issues and a **stable** branch that will be used for stable code and tagging releases.

If at all possible, please try to create local branches for isses to work on and then incorporate these changes into one of the main branches.

Do try to commit ofthen and in manageable chunks (it could later on be **squashed**, if needed).

Every commit should have a meaningful message describing what it brings. The message could only consist of a short line, though more details explanation as second part of sommit message is strongly encouraged.

**BN! Please separate short and long parts of the commit message by a newline. This produces better results when viewing commits.**

### Issues and milestones

[GitHub](https://github.com) issue tracker will be used for management of development flow.

**NB! Please assign ans issue to yourself if you plan on working on it. Do not work on issues that are unassigned.**

If you ever spot an issue that seems to big to managed at once, please do split it into several smaller ones that could be worked on either in parallel on one after another. This way it would give a better overview of activities.

## Running

### Development

### Production

## Building and packaging
