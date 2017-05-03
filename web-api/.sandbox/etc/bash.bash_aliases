#!/bin/bash


# Helper function for checking if array contains an element.

function array_contains(){
    local array="$1[@]"
    local seeking=$2
    for element in "${!array}"; do
        if [[ $element == $seeking ]]; then
            return 0
        fi
    done
    return 1
}


# Set up alias for pip to always install into user base. Since we're
# not using virtualenvs but want to install all Python packages into
# user base, we're overriding pip's default command.

function pip_userbase(){
    userbase_commands=("install" "freeze" "list")
    if array_contains userbase_commands $1;
    then
        /usr/local/bin/pip "$@" --user;
    else
        /usr/local/bin/pip "$@";
    fi
}

alias pip='pip_userbase'
