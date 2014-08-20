# CodaLab Bundle Service [![Build Status](https://travis-ci.org/codalab/codalab-cli.png?branch=master)](https://travis-ci.org/codalab/codalab-cli)

The goal of CodaLab is to faciliate transparent, reproducible, and
collaborative research in computation- and data-intensive areas such as machine
learning.  Think Git for experiments.  This repository contains the code for
the CodaLab Bundle Service and provides the foundation on which the [CodaLab
website](https://github.com/codalab/codalab) is built.

The CodaLab Bundle Service allows users to create *bundles*, which are
immutable directories containing code or data.  Bundles are either
uploaded or created from other bundles by executing arbitrary commands.
When the latter happens, all the provenance information is preserved.  In
addition, users can create *worksheets*, which interleave bundles with
free-form textual descriptions, allowing one to easily describe an experimental
workflow.

This package also contains a command-line interface `cl` that provides flexible
access to the CodaLab Bundle Service.  The [CodaLab
website](https://github.com/codalab/codalab) provides a graphical interface to
the service, as well as supporting competitions.

## Installation

1. Make sure you have the dependencies (Python 2.7 and virtualenv).  If you're running Ubuntu:

        sudo apt-get install python2.7 python2.7-dev python-virtualenv

2. Clone the CodaLab repository:

        git clone https://github.com/codalab/codalab-cli
        cd codalab-cli

3. Run the setup script (will install things into a Python virtual environment):

        ./setup.sh

4. Set your path to include CodaLab for convenience (add this line to your `.bashrc`):

        export PATH=$PATH:<your path>/codalab-cli/codalab/bin

Now you are ready to start using CodaLab!

## Filesystem analogy

CodaLab is structured much like a classic operating system, so it's useful to
keep the following analogy in mind:

- shell = CodaLab session (usually identified by the process ID of the shell)
- drive = CodaLab instance (e.g., `http://localhost:2800`)
- directory = CodaLab worksheet (e.g., `default`)
- file = CodaLab bundle (e.g., `stanford-corenlp`)
- line in a file = CodaLab target (e.g., `stanford-corenlp/src`)

There are some differences, however:

- The contents of bundles are immutable (only the metadata is mutable), whereas
  files are mutable.
- A worksheet contains bundles in a user-specified order interleaved with text,
  whereas a directory in a file system contains an unordered set of files.
- CodaLab maintains the provenance information for each derived bundle.

## Basic Local Usage

### Orienting oneself

Print out the list of available commands:

    cl

Print out options for each command (e.g., upload):

    cl upload -h

Each shell is associated with a CodaLab session.  To get the status of the
current session (like running `pwd`):

    cl status

You can change your CodaLab settings here:

    ~/.codalab/config.json

Now let's walk through a simple example to demonstrate the capabilities of
CodaLab.  The goal is to sort a file.

### Uploading bundles

Uploading means transferring information from the filesystem into a CodaLab
instance.  The CodaLab instance could be running locally.

To see how this works, let's create an example dataset bundle to upload:

    echo -e "foo\nbar\nbaz" > a.txt

Upload the dataset into CodaLab as follows.  (The `--edit` (or `-e`) will pop
up a text editor to allow you to edit the metadata of this bundle.  You are
encouraged to fill this information out!)

    cl upload dataset a.txt --edit

This will print out a 32-character UUID which uniquely identifies the Bundle.
Forever.  You can't edit the contents since bundles are immutable, but you can
go back and edit the metadata:

    cl edit a.txt

List the bundles you've uploaded.  This should show the new bundle that you
uploaded.

    cl ls

You can see the statistics about the bundle:

    cl info -v a.txt

If `a.txt` had been a directory, then you could specify *targets* inside a
bundle (e.g., `a.txt/file1`).

Let's now create and upload the sorting program:

    echo -e "import sys\nfor line in sorted(sys.stdin.readlines()): print line," > sort.py
    cl upload program sort.py

### Creating runs

One can upload program and dataset bundles, but the interesting part is that
new bundles can be generated by running bundles.  A *run* bundle consists of a
set of dependencies on existing bundles and an arbitrary *command* to execute.
When CodaLab runs this command behind the scenes, it makes sure the
dependencies are put into the right place.

Let us create our first run bundle:

    cl run :sort.py input:a.txt 'python sort.py < input > output' --name sort-run

The first two arguments specify the dependencies and the third is the command.
Note that `cl run` doesn't actually run anything; it just creates the run
bundle and returns immediately.  You can see by doing `cl ls` that it's been
created, but it's state is `created`, not `ready`.  (You can add `-t` or
`--tail` to make `cl run` block and print out stdout/stderr, more like how you
would normally run a program.)

Look inside the bundle:

    cl info sort-run

You'll see that like any bundle, it consists of a set of files and directories.
Under *provenance*, you will see two files (*keys*), `sort.py` and `input`,
which point to the *targets* `sort.py` and `a.txt`.  (When we wrote `:sort.py`,
`sort.py` was used as both the key and to identify the target.)

Note that runs don't have to have dependencies.  Here's a trivial run that doesn't:

    cl run 'echo hello'

Now let's actually excute this run bundle.  In general, a CodaLab instance
would already have workers constantly executing run bundles, but we're running
locally, so we have to start up our own worker.  Run this in another shell:

    cl worker

(See `~/.codalab/config.json` to customize the worker.)  You should see that this
shell immediately executes the run.  In our original shell, we can check that
the run completed successfully.

    cl info -v sort-run

We can look at individual targets inside the bundle:

    cl cat sort-run/output

To make things more convenient, we can define a bundle that points to a target:

    cl make sort-run/output --name a-sorted.txt
    cl cat a-sorted.txt

We can also download the results to local disk:

    cl download a-sorted.txt

If you messed up somewhere, you can always remove a bundle:

    cl rm sort-run

You'll see that the above command threw an error, because `a-sorted.txt`
depends on `sort-run`.  To delete both bundles, you can remove recursively:

    cl rm -r sort-run

#### Sugar

You can also include the bundle references in your run command, which might be more natural:

    cl run :sort.py input:a.txt 'python %sort.py% < %a.txt% > output' --name sort-run

This is equivalent to running:

    cl run 1:sort.py 2:a.txt 'python 1 < 2 > output' --name sort-run

### Macros

Once we produce a run, we might want to do it again with slightly different
settings (e.g., sort another example).  CodaLab macros allow you to do this,
although understanding this concept requires us to take a step back.

In CodaLab, bundles form a directed acyclic graph (DAG), where nodes are
bundles and a directed edge from A to B means that B depends on A.  Imagine we
have created some runs that produces some output bundle O from some input
bundle I; I is an ancestor of O in the DAG.  Now suppose we have a new input
bundle I', how can we produce the analogous O'.  The *mimic* command does
exactly this.

First, recall that we have created `a.txt` (I) and `sort-run` (O).  Let us
create another bundle and upload it:

    echo -e "6\n3\n8" > b.txt
    cl upload dataset b.txt

Now we can apply the same thing to `b.txt` that we did to `a.txt`:

    cl mimic a.txt a-sorted.txt b.txt --name b-sorted.txt

We can check that `b.txt.sorted` contains the desired sorted result:

    cl cat b-sorted.txt

Normally, we define macros as abstract entities.  Here, notice that we've
started instead by creating a concrete example, and then used analogy to
reapply this.  A positive side-effect is that every macro automatically comes
with an example of how it is used!

We can make the notion of a macro even more explicit.  Let's rename `a.txt` to
`sort-in1` and `a-sorted.txt` to `sort-out`:

    cl edit a.txt --name sort-in1
    cl edit a-sorted.txt --name sort-out

Then we can use the following syntactic sugar:

    cl macro sort b.txt --name b-sorted.txt

In Codalab, macros are not defined ahead of time, but are constructed on the
fly from the bundle DAG.

### Worksheet basics

So far, every bundle we've created has been added to the `default` worksheet.
Recall that a worksheet is like a directory, but we can do much more.  We can edit
the worksheet:

    cl wedit

In this editor, we can enter arbitrary text interleaved with the bundles that
we have created so far.  Try adding some text, saving, and exiting the editor.
Then we can display the contents of this worksheet in a more rendered fashion.

    cl print

We can add another worksheet by doing:

    cl new scratch

We can see that the worksheet is empty:

    cl ls

And that we have two worksheets (`default` and `scratch`):

    cl wls

We are current on `scratch`.  We can switch to the other one (analogous to
switching directories using `cd`):

    cl work default
    cl work scratch

We can add items to a worksheet:

    cl add -m "Here's a simple bundle:"
    cl add sort.py
    cl print

Another way to add bundles to a worksheet is to use `cl wedit` and entering additional lines:

    {sort.py}

If you save, exit, and open up the worksheet again, you'll see that the
reference has been resolved.  In general, editing the worksheet with a text
editor gives you a lot of flexibility for organizing bundles.

To remove the worksheet (and you will need to switch off it):

    cl wrm scratch

Note that the bundles are not deleted.

### Referring to bundles

So far, we have referred to bundles by their names, which have been unique.  In
a large CodaLab system with many users, names are not unique, not even within
the same worksheet.  A *bundle_spec* refers to the string that identifies a
bundle, importantly given the context (instance, current worksheet).

There are finally a number of other ways to

- UUID (`0x3739691aef9f4b07932dc68f7db82de2`): this should match at most one
  bundle.
- Prefix of UUID (`0x3739`): matches all bundles whose UUIDs start with this
  prefix.
- Name prefix (`foo`): matches all bundles with the given name.
  You can use `foo%` to match bundles that begin with `foo` or `%foo%` to match
  bundles that contain `foo` (SQL LIKE syntax).
- Ordering (`^, ^2, ^3`): returns the first, second, and third last bundles on
  the current worksheet.
- Named ordering (`foo^, foo^2, foo^3`): returns the first, second, and third
  last bundles with the given name on the current worksheet.

Each of the above produces some number of bundles.  Exactly one is chosen
based on the following rules (in order of precedence):

1. Bundles in the current worksheet are preferred to those not.
2. Later bundles are preferred.

### Displaying worksheets

[TODO]

## Working remotely

So far, we have been doing everything locally, but one advantage of CodaLab is
to have a centralized instance so that both the data and the computational
resources can be shared and scaled.

To start off, we can create a CodaLab instance by simply running the following
in another shell:

    cl server

By default, the server is running at `http://localhost:2800`.  You can change
this in `~/.codalab/config.json`.

For security reasons, the server is only accessible from localhost.  To make
the server accessible from anywhere, under "server" / "host" in
`~/.codalab/config.json`, change "localhost" to "".

Now we can connect to this server by switching both the worksheet (directory)
and the instance (drive):

    cl work http://localhost:2800::default

In this case, any commands you do will be equivalent to before since the
CodaLab server is backed by the same database.  The only difference is that all
calls go through the web server, so you can potentially access this server from
another machine.  By default, `localhost` is aliased to `http://localhost:2800`,
so we could have also typed:

    cl work localhost::default

To switch back to `local` mode, type:

    cl work local

To make things more interesting, let us create a separate CodaLab instance:

    export CODALAB_HOME=~/.codalab2
    cl ls

You should see that there's nothing there because we are now accessing the new
CodaLab, which is backed by a different database (normally, these would be on
different machines).  We can copy bundles between CodaLab instances by doing:

    cl cp localhost::a.txt local

Now there are two physical copies of the bundle `a.txt`, and they have the same
bundle UUID.  We can create a bundle and copy it in the other direction too:

    echo hello > hello.txt
    cl upload dataset hello.txt
    cl cp hello.txt localhost

To summarize, `~/.codalab` and `~/.codalab2` correspond to two databases.  In
each CodaLab session, the `local` instance points directly to one database, and
`localhost` just points to some URL, which is backed by one database, which in
theory can be the same, but in practice is usually different.

## Using MySQL

By default, CodaLab is configured to use SQLite, and the database file is just a single
file in `~/.codalab`.  While this is a quick way to get started, SQLite is not a very
scalable solution.  Here are instructions to set up MySQL:

Install the MySQL server.  On Ubuntu, run:

    sudo apt-get install mysql-server

Install the MySQL Python:

    codalab_env/bin/pip install MySQL-python

In the configuration file `.codalab/config.json`,
change `"class": "SQLiteModel"` to

    "class": "MySQLModel",
    "engine_url": "mysql://<username>:<password>@<host>:<port>/<database>",

For example:

    "engine_url": "mysql://codalab@localhost:3306/codalab_bundles",

If you already have data in SQLite, you can load it into MySQL as follows:

    sqlite3 ~/.codalab/bundle.db .dump > bundles.sqlite
    python scripts/sqlite_to_mysql.py < bundles.sqlite > bundles.mysql 
    mysql -u codalab -p codalab_bundles < bundles.mysql

## Authentication

[TODO]

# For developers

[TODO]

Here are some helpful links:

- [CodaLab instance](http://codalab.org/)
- [GitHub site](http://codalab.github.io/codalab/)
- [GitHub repository](https://github.com/codalab/codalab)
- [Codalab Wiki](https://github.com/codalab/codalab/wiki)

## Code design

Bundle hierarchy:

    Bundle
      NamedBundle
        UploadedBundle
          ProgramBundle
          DatsaetBundle
        MakeBundle [DerivedBundle]
        RunBundle [DerivedBundle]

## Unit tests

To run tests on the code, first install the libraries for testing:

    codalab_env/bin/pip install mock nose

Then run all the tests:

    codalab_env/bin/nosetests

## Database migrations

Migrations are handled with [Alembic](http://alembic.readthedocs.org/en/latest/).

If you are planning to add a migration, please check whether:

* You have a fresh DB with no migrations, or
* You have already done a migration and wish to add/upgrade to another.

By running this command:

    codalab_env/bin/alembic current

If you have a migration, it will show you your last migration (head).  (In this
case it's `341ee10697f1`.)

    INFO  [alembic.migration] Context impl SQLiteImpl.
    INFO  [alembic.migration] Will assume non-transactional DDL.
    Current revision for sqlite:////Users/Dave/.codalab/bundle.db: 531ace385q2 -> 341ee10697f1 (head), name of migration

If the DB has no migrations and is all set, the output will be:

    INFO  [alembic.migration] Context impl SQLiteImpl.
    INFO  [alembic.migration] Will assume non-transactional DDL.
    Current revision for sqlite:////Users/Dave/.codalab/bundle.db: None

##### You have a fresh DB with no migrations.

Simply stamp your current to head and add your migration:

    codalab_env/bin/alembic stamp head

##### You have already done a migration and wish to upgrade to another.

    codalab_env/bin/alembic upgrade head

[TODO write about edge cases]

### Adding a new migration

Add your change to the table in `tables.py`.

Add your migration:

     codalab_env/bin/alembic revision -m "<your commit message here>" --autogenerate

This will handle most use cases but **check the file it generates**.

If it is not correct please see the [Alembic
Docs](http://alembic.readthedocs.org/en/latest/tutorial.html#create-a-migration-script)
for more information on the migration script.

Make sure you also update COLUMNS in the correct ORM object (e.g., `objects/worksheet.py`).

Finally upgrade to your migration:

     codalab_env/bin/alembic upgrade head
